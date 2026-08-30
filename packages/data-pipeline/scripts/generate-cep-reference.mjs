/**
 * Gera a referencia de setores de CEP consumida pelo mock de geocodificacao
 * da API (B-03, ADR-0023).
 *
 * O setor e o prefixo de cinco digitos do CEP. Para cada setor onde existe ao
 * menos uma unidade escolar com coordenada conhecida, publica o centroide
 * dessas unidades e o bairro mais frequente. O resultado cobre 89% dos CEPs
 * reais de familias nos cinco processos; o resto falha, que e o comportamento
 * correto — PRD 8.2 exige um caminho para quando a geocodificacao nao resolve.
 *
 * Roda sob demanda, como as fixtures: depende dos datasets, que nao sao
 * versionados. A saida e versionada porque a API precisa dela no CI.
 */
import { readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DuckDBInstance } from '@duckdb/node-api';

const here = dirname(fileURLToPath(import.meta.url));
const CURATED = join(here, '../../../data/curated');
const DESTINO = join(here, '../../../apps/api/src/geocoding/cep-sectors.json');

const versoes = readdirSync(CURATED).sort();
const ultima = versoes.at(-1);
if (ultima === undefined) {
  throw new Error(
    `Nenhuma importacao encontrada em ${CURATED}. Rode "pnpm --filter @match/data-pipeline ingest".`,
  );
}
const unidades = join(CURATED, ultima, 'unidades.parquet');

const c = await (await DuckDBInstance.create(':memory:')).connect();
const rows = await (
  await c.run(`
    WITH com_coordenada AS (
      SELECT cep[1:5] AS setor, bairro, latitude, longitude
      FROM read_parquet('${unidades}')
      WHERE cep IS NOT NULL AND tem_coordenada
    ),
    bairro_dominante AS (
      SELECT setor, bairro, count(*) AS n,
             row_number() OVER (PARTITION BY setor ORDER BY count(*) DESC, bairro) AS posicao
      FROM com_coordenada WHERE bairro IS NOT NULL GROUP BY setor, bairro
    ),
    centroides AS (
      SELECT setor, avg(latitude) AS clat, avg(longitude) AS clon
      FROM com_coordenada GROUP BY setor
    )
    SELECT
      s.setor,
      round(any_value(c.clat), 6) AS lat,
      round(any_value(c.clon), 6) AS lon,
      count(*)                    AS unidades,
      any_value(b.bairro)         AS bairro,
      -- Raio: maior distancia entre uma unidade do setor e o centroide. Publicado
      -- para que a API declare a incerteza em vez de fingir precisao uniforme —
      -- os setores vao de ~200 m a ~11 km.
      round(max(sqrt(
        pow((s.latitude - c.clat) * 111.0, 2) +
        pow((s.longitude - c.clon) * cos(radians(c.clat)) * 111.0, 2)
      )), 2) AS raio_km
    FROM com_coordenada s
    JOIN centroides c ON c.setor = s.setor
    LEFT JOIN bairro_dominante b ON b.setor = s.setor AND b.posicao = 1
    GROUP BY s.setor
    ORDER BY s.setor
  `)
).getRowObjectsJson();

const bairros = (
  await (
    await c.run(`
      SELECT DISTINCT bairro FROM read_parquet('${unidades}')
      WHERE bairro IS NOT NULL ORDER BY bairro
    `)
  ).getRowObjectsJson()
).map((linha) => linha.bairro);

const referencia = {
  // Rastreabilidade ate a importacao que produziu o arquivo.
  importVersion: ultima,
  generatedFrom: 'cur_unidades: centroide das unidades escolares por setor de CEP',
  sectors: Object.fromEntries(
    rows.map((linha) => [
      linha.setor,
      {
        lat: Number(linha.lat),
        lon: Number(linha.lon),
        bairro: linha.bairro ?? null,
        unidades: Number(linha.unidades),
        raioKm: Number(linha.raio_km),
      },
    ]),
  ),
  neighborhoods: bairros,
};

writeFileSync(DESTINO, `${JSON.stringify(referencia, null, 2)}\n`);
console.log(`${rows.length} setores e ${bairros.length} bairros escritos em ${DESTINO}`);
