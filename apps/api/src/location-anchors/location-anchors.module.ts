import { Module } from '@nestjs/common';

import { GeocodingModule } from '../geocoding/geocoding.module';
import { LOCATION_ANCHOR_REPOSITORY } from './location-anchor.repository';
import { LocationAnchorsController } from './location-anchors.controller';
import { LocationAnchorsService } from './location-anchors.service';
import { PrismaLocationAnchorRepository } from './prisma-location-anchor.repository';

@Module({
  imports: [GeocodingModule],
  controllers: [LocationAnchorsController],
  providers: [
    LocationAnchorsService,
    { provide: LOCATION_ANCHOR_REPOSITORY, useClass: PrismaLocationAnchorRepository },
  ],
  exports: [LocationAnchorsService],
})
export class LocationAnchorsModule {}
