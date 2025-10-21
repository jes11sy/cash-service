import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { HandoverService } from './handover.service';
import { CreateHandoverDto, ApproveHandoverDto } from './dto/handover.dto';
import { RolesGuard, Roles, UserRole } from '../auth/roles.guard';

@ApiTags('handover')
@Controller('handover')
export class HandoverController {
  constructor(private handoverService: HandoverService) {}

  @Get('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Health check endpoint' })
  async health() {
    return {
      success: true,
      message: 'Handover module is healthy',
      timestamp: new Date().toISOString(),
    };
  }

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.DIRECTOR, UserRole.MASTER)
  @ApiOperation({ summary: 'Get all handovers' })
  async getHandovers(@Query() query: any, @Request() req: any) {
    return this.handoverService.getHandovers(query, req.user);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.DIRECTOR, UserRole.MASTER)
  @ApiOperation({ summary: 'Get handover by ID' })
  async getHandover(@Param('id') id: string) {
    return this.handoverService.getHandover(+id);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.MASTER)
  @ApiOperation({ summary: 'Create handover submission' })
  async createHandover(@Body() dto: CreateHandoverDto, @Request() req: any) {
    return this.handoverService.createHandover(dto, req.user);
  }

  @Patch(':id/submit')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.MASTER)
  @ApiOperation({ summary: 'Submit handover for approval' })
  async submitHandover(@Param('id') id: string) {
    return this.handoverService.submitHandover(+id);
  }

  @Patch(':id/approve')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.DIRECTOR)
  @ApiOperation({ summary: 'Approve/reject handover' })
  async approveHandover(@Param('id') id: string, @Body() dto: ApproveHandoverDto, @Request() req: any) {
    return this.handoverService.approveHandover(+id, dto, req.user);
  }
}

