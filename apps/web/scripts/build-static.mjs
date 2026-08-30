/**
 * Gera o pacote estatico para hospedagem de arquivos (Hostinger).
 *
 * O `next build` com `output: 'export'` produz `out/`. Falta o que so o servidor
 * web pode fazer, e que no modo com servidor o proprio Next fazia:
 *
 * - **Cabecalhos de seguranca.** `headers()` nao existe na exportacao estatica.
 *   Eles sao lidos de `next.config.mjs`, que continua sendo a unica fonte, e
 *   escritos num `.htaccess` para o Apache da Hostinger.
 * - **Erro 404.** A exportacao gera `404.html`, mas o Apache so o usa se for
 *   apontado por `ErrorDocument`.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// O modo precisa estar ligado ANTES de a config ser avaliada: `securityHeaders`
// e calculado no topo daquele modulo. Como `import` estatico e içado e roda
// antes de qualquer atribuicao, a importacao aqui precisa ser dinamica — senao
// a CSP sai autorizando a origem da API, que no build estatico nem existe.
process.env.NEXT_PUBLIC_STATIC_MODE = 'true';
const { securityHeaders } = await import('../next.config.mjs');

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', 'out');

const linhasDeCabecalho = securityHeaders
  .map(({ key, value }) => `  Header always set ${key} "${value.replaceAll('"', '\\"')}"`)
  .join('\n');

const htaccess = `# Gerado por scripts/build-static.mjs — nao editar a mao.
# Os cabecalhos vem de apps/web/next.config.mjs, a mesma fonte usada pelo modo
# com servidor, para que os dois nao divirjam.

<IfModule mod_headers.c>
${linhasDeCabecalho}
</IfModule>

# A exportacao usa trailingSlash, entao cada rota e um index.html em sua pasta.
ErrorDocument 404 /404.html

<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css application/javascript application/json image/svg+xml
</IfModule>

# Os arquivos sob /_next/static levam hash no nome e podem ser cacheados para
# sempre; o HTML nao, senao uma publicacao nova demora a aparecer.
<IfModule mod_expires.c>
  ExpiresActive On
  <FilesMatch "\\.(js|css|woff2|svg|png|jpg|webp)$">
    ExpiresDefault "access plus 1 year"
  </FilesMatch>
  <FilesMatch "\\.html$">
    ExpiresDefault "access plus 0 seconds"
  </FilesMatch>
</IfModule>
`;

writeFileSync(join(OUT, '.htaccess'), htaccess);
console.log(`.htaccess escrito com ${securityHeaders.length} cabeçalhos de segurança em ${OUT}`);
