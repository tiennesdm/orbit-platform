/**
 * Email + Auth enhancement module
 */

import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { AuthCodeService } from './auth-code.service';
import { AuthEnhancementController } from './auth-enhancement.controller';
import { IdentityModule } from '../identity/identity.module';

@Module({
  imports: [IdentityModule],
  controllers: [AuthEnhancementController],
  providers: [EmailService, AuthCodeService],
  exports: [EmailService, AuthCodeService],
})
export class EmailModule {}
