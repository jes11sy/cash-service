import { Controller, Get, Post, Put, Patch, Body, Param, Query, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CashService } from './cash.service';
import { CreateCashDto, UpdateCashDto, ApproveCashDto } from './dto/cash.dto';
import { RolesGuard, Roles, UserRole } from '../auth/roles.guard';

@ApiTags('cash')
@Controller('cash')
export class CashController {
  constructor(private cashService: CashService) {}

  @Get('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Health check endpoint' })
  async health() {
    return {
      success: true,
      message: 'Cash module is healthy',
      timestamp: new Date().toISOString(),
    };
  }

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.director, UserRole.master)
  @ApiOperation({ summary: 'Get all cash transactions' })
  async getCashTransactions(@Query() query: any, @Request() req: any) {
    return this.cashService.getCashTransactions(query, req.user);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.director, UserRole.master)
  @ApiOperation({ summary: 'Get cash transaction by ID' })
  async getCashTransaction(@Param('id') id: string) {
    return this.cashService.getCashTransaction(+id);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.director, UserRole.master, UserRole.operator, UserRole.callcentre_operator, UserRole.callcentre_admin)
  @ApiOperation({ summary: 'Create cash transaction' })
  async createCash(@Body() dto: CreateCashDto, @Request() req: any) {
    return this.cashService.createCash(dto, req.user);
  }

  @Put(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.director, UserRole.master)
  @ApiOperation({ summary: 'Update cash transaction' })
  async updateCash(@Param('id') id: string, @Body() dto: UpdateCashDto) {
    return this.cashService.updateCash(+id, dto);
  }

}














