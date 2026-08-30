import { Module } from '@nestjs/common';

import { CONTACT_REPOSITORY } from './contact.repository';
import { ContactFingerprintService } from './contact-fingerprint.service';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';
import { PrismaContactRepository } from './prisma-contact.repository';

@Module({
  controllers: [ContactsController],
  providers: [
    ContactsService,
    ContactFingerprintService,
    { provide: CONTACT_REPOSITORY, useClass: PrismaContactRepository },
  ],
  exports: [ContactsService],
})
export class ContactsModule {}
