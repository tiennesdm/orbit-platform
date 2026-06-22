import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FederationService } from './federation.service';
import { z } from 'zod';

const RegisterHandleSchema = z.object({
  handle: z.string().min(3).max(253),
  pdsEndpoint: z.string().url().optional(),
  publicKey: z.string().optional(),
});

const DomainSchema = z.object({ domain: z.string().min(3).max(253) });

@ApiTags('federation')
@Controller('federation')
export class FederationController {
  constructor(private readonly f: FederationService) {}

  @Public()
  @Get('resolve/:handle')
  async resolve(@Param('handle') handle: string) {
    return this.f.resolveHandle(handle);
  }

  @Public()
  @Get('did/:did')
  async resolveDid(@Param('did') did: string) {
    return this.f.resolveDid(did);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('handle')
  async register(@CurrentUser('did') did: string, @Body() body: z.infer<typeof RegisterHandleSchema>) {
    return this.f.registerHandle({ ...body, did });
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('domain')
  async setupDomain(@CurrentUser('did') did: string, @Body() body: z.infer<typeof DomainSchema>) {
    return this.f.setupDomainHandle({ ownerDid: did, ...body });
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('domain/:domain/verify')
  async verifyDomain(@Param('domain') domain: string, @CurrentUser('did') did: string) {
    return this.f.verifyDomainHandle(domain, did);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('me/domains')
  async myDomains(@CurrentUser('did') did: string) {
    return this.f.listMyDomains(did);
  }
}
