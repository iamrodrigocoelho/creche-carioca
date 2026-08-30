export { loadConfig, findRepoRoot, type PipelineConfig } from './config';
export { ingest, PIPELINE_VERSION, type IngestOptions, type IngestResult } from './pipeline';
export {
  isWithinRio,
  normalizeCep,
  normalizeText,
  normalizeUnitCode,
  nullify,
  parseCoordinate,
  RIO_BOUNDS,
} from './normalize';
export { SOURCE_FILES, type SourceFile } from './sources';
export {
  assertPublishable,
  assertUnitsReconcile,
  EXPECTED_ROWS,
  runQualityChecks,
  UNIQUE_KEYS,
  validateKeys,
  type QualityFinding,
  type QualityReport,
  type Severity,
} from './quality';
export {
  fingerprint,
  importVersionFor,
  type ImportManifest,
  type SourceFingerprint,
} from './provenance';
export { CURATED_TABLES, curatedFileName, type CuratedTable } from './staging';
