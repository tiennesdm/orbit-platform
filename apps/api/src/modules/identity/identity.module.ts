import { Module } from '@nestjs/common';
import { IdentityController } from './identity.controller';
import { IdentityService } from './identity.service';
import { WebAuthnService } from './webauthn.service';
import { PortableIdentityService } from './portable-identity.service';

@Module({
  controllers: [IdentityController],
  providers: [IdentityService, WebAuthnService, PortableIdentityService],
  exports: [IdentityService, PortableIdentityService],
})
export class IdentityModule {}
