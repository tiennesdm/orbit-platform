import { Body, Controller, Get, Param, Post as HttpPost, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { z } from 'zod';
import { GroupService } from './group.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { Group, Event } from '@orbit/types';

const CreateGroupSchema = z.object({
  name: z.string().min(3).max(80),
  slug: z.string().regex(/^[a-z0-9-]+$/).min(3).max(50),
  description: z.string().max(500).optional(),
  privacy: z.enum(['public', 'private', 'hidden']).default('public'),
  topics: z.array(z.string()).max(10).optional(),
  rules: z.string().max(5000).optional(),
});

const CreateEventSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(5000).optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional(),
  locationType: z.enum(['online', 'physical', 'hybrid']).optional(),
  location: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  isTicketed: z.boolean().optional(),
  ticketPriceCents: z.number().optional(),
  currency: z.string().default('INR'),
});

@ApiTags('groups')
@ApiBearerAuth()
@Controller('groups')
export class GroupController {
  constructor(private readonly groups: GroupService) {}

  @Get()
  @ApiOperation({ summary: 'List groups user is a member of' })
  async myGroups(@CurrentUser('did') did: string): Promise<Group[]> {
    return this.groups.listUserGroups(did);
  }

  @Get(':groupId')
  @ApiOperation({ summary: 'Get group details' })
  async get(@Param('groupId') groupId: string): Promise<Group> {
    const group = await this.groups.getGroup(groupId);
    if (!group) throw new Error('Group not found');
    return group;
  }

  @HttpPost()
  @ApiOperation({ summary: 'Create a new group' })
  async create(
    @CurrentUser('did') did: string,
    @Body() body: z.infer<typeof CreateGroupSchema>
  ): Promise<Group> {
    return this.groups.createGroup(did, body);
  }

  @HttpPost(':groupId/join')
  @ApiOperation({ summary: 'Join a group' })
  async join(
    @CurrentUser('did') did: string,
    @Param('groupId') groupId: string
  ) {
    return this.groups.joinGroup(did, groupId);
  }

  @Get(':groupId/events')
  @ApiOperation({ summary: 'List upcoming events in a group' })
  async events(
    @Param('groupId') groupId: string,
    @Query('upcoming') upcoming?: string
  ): Promise<Event[]> {
    return this.groups.listGroupEvents(groupId, upcoming !== 'false');
  }

  @HttpPost(':groupId/events')
  @ApiOperation({ summary: 'Create an event in a group' })
  async createEvent(
    @CurrentUser('did') did: string,
    @Param('groupId') groupId: string,
    @Body() body: z.infer<typeof CreateEventSchema>
  ): Promise<Event> {
    return this.groups.createEvent(did, groupId, body);
  }
}
