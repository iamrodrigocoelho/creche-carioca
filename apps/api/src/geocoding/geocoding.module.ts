import { Module } from '@nestjs/common';

import { CepSectorGeocodingProvider } from './cep-sector-geocoding.provider';
import { GEOCODING_PROVIDER } from './geocoding.provider';

/**
 * B-03 permanece aberto: nenhum provider real foi escolhido. Trocar o adapter
 * simulado por um servico de verdade e uma alteracao de uma linha aqui.
 */
@Module({
  providers: [{ provide: GEOCODING_PROVIDER, useClass: CepSectorGeocodingProvider }],
  exports: [GEOCODING_PROVIDER],
})
export class GeocodingModule {}
