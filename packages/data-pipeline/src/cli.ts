import { ingest } from './pipeline';

async function main(): Promise<void> {
  const result = await ingest();
  process.stdout.write(`Publicado em ${result.outputDir}\n`);
  for (const table of result.manifest.tables) {
    process.stdout.write(
      `  ${table.name.padEnd(24)} ${table.rows.toLocaleString('pt-BR')} linhas\n`,
    );
  }
  const relevantes = result.report.findings.filter((finding) => finding.count > 0);
  process.stdout.write(`\nRelatorio de qualidade: ${relevantes.length} achado(s)\n`);
  for (const finding of relevantes) {
    process.stdout.write(`  [${finding.severity}] ${finding.id}: ${finding.count}\n`);
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
