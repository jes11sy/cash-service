import { Controller, Get, Post, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { HandoverService } from './handover.service';
import { RolesGuard, Roles, UserRole } from '../auth/roles.guard';
import { GetHandoverQueryDto } from '../cash/dto/query.dto';
import { RequestUser } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('handover')
@Controller('handover')
export class HandoverController {
  constructor(private handoverService: HandoverService) {}

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.master)
  @ApiOperation({ summary: 'Get master cash submissions with pagination' })
  @ApiResponse({ status: 200, description: 'Cash submissions retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only masters can access' })
  async getMasterCashSubmissions(
    @Query() query: GetHandoverQueryDto,
    @Request() req: { user: RequestUser }
  ) {
    return this.handoverService.getMasterCashSubmissions(query, req.user);
  }
}
