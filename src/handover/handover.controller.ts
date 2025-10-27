import { Controller, Get, Post, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { HandoverService } from './handover.service';
import { RolesGuard, Roles, UserRole } from '../auth/roles.guard';

@ApiTags('handover')
@Controller('handover')
export class HandoverController {
  constructor(private handoverService: HandoverService) {}

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.MASTER)
  @ApiOperation({ summary: 'Get master cash submissions' })
  async getMasterCashSubmissions(@Query() query: any, @Request() req: any) {
    return this.handoverService.getMasterCashSubmissions(query, req.user);
  }
}
