import { Controller, Get, Post, Put, Patch, Body, Param, Query, UseGuards, Request, HttpCode, HttpStatus, ParseIntPipe, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CashService } from './cash.service';
import { CreateCashDto, UpdateCashDto, ApproveCashDto } from './dto/cash.dto';
import { GetCashQueryDto } from './dto/query.dto';
import { RolesGuard, Roles, UserRole } from '../auth/roles.guard';
import { RequestUser } from '../auth/interfaces/jwt-payload.interface';

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
  @Roles(UserRole.admin, UserRole.director, UserRole.master, UserRole.callcentre_admin)
  @ApiOperation({ summary: 'Get all cash transactions with pagination' })
  @ApiResponse({ status: 200, description: 'Transactions retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getCashTransactions(
    @Query() query: GetCashQueryDto,
    @Request() req: { user: RequestUser }
  ) {
    return this.cashService.getCashTransactions(query, req.user);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.admin, UserRole.director, UserRole.master, UserRole.callcentre_admin)
  @ApiOperation({ summary: 'Get cash transaction by ID with IDOR protection' })
  @ApiResponse({ status: 200, description: 'Transaction retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Access denied' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async getCashTransaction(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: { user: RequestUser }
  ) {
    const transaction = await this.cashService.getCashTransaction(id);
    
    // 🔒 IDOR Protection: Проверяем права доступа
    // Админ может видеть все транзакции
    if (req.user.role === UserRole.admin || req.user.role === UserRole.callcentre_admin) {
      return transaction;
    }

    // Директор может видеть только транзакции из своих городов
    if (req.user.role === UserRole.director) {
      if (req.user.cities && req.user.cities.length > 0 && !req.user.cities.includes(transaction.data.city)) {
        throw new ForbiddenException('У вас нет доступа к этой транзакции');
      }
      return transaction;
    }

    // Мастер может видеть только свои транзакции
    if (transaction.data.nameCreate !== req.user.name) {
      throw new ForbiddenException('У вас нет доступа к этой транзакции');
    }

    return transaction;
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.admin, UserRole.director, UserRole.master, UserRole.operator, UserRole.callcentre_operator, UserRole.callcentre_admin)
  @ApiOperation({ summary: 'Create cash transaction with validation' })
  @ApiResponse({ status: 201, description: 'Transaction created successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request - Validation failed' })
  @ApiResponse({ status: 409, description: 'Conflict - Duplicate payment purpose' })
  async createCash(
    @Body() dto: CreateCashDto,
    @Request() req: { user: RequestUser }
  ) {
    return this.cashService.createCash(dto, req.user);
  }

  @Put(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.admin, UserRole.director, UserRole.master, UserRole.callcentre_admin)
  @ApiOperation({ summary: 'Update cash transaction with IDOR protection' })
  @ApiResponse({ status: 200, description: 'Transaction updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Access denied' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async updateCash(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCashDto,
    @Request() req: { user: RequestUser }
  ) {
    // 🔒 IDOR Protection: Проверяем права перед обновлением
    const transaction = await this.cashService.getCashTransaction(id);
    
    if (
      req.user.role !== UserRole.admin &&
      req.user.role !== UserRole.director &&
      req.user.role !== UserRole.callcentre_admin &&
      transaction.data.nameCreate !== req.user.name
    ) {
      throw new ForbiddenException('У вас нет прав на обновление этой транзакции');
    }

    return this.cashService.updateCash(id, dto, req.user);
  }

}














