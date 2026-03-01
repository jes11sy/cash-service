import { Controller, Get, Post, Put, Delete, Patch, Body, Param, Query, UseGuards, Request, HttpCode, HttpStatus, ParseIntPipe, ForbiddenException, Ip } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { CookieJwtAuthGuard } from '../auth/guards/cookie-jwt-auth.guard';
import { CashService } from './cash.service';
import { CreateCashDto, UpdateCashDto, ApproveCashDto } from './dto/cash.dto';
import { GetCashQueryDto } from './dto/query.dto';
import { RolesGuard, Roles, UserRole } from '../auth/roles.guard';
import { RequestUser } from '../auth/interfaces/jwt-payload.interface';
import { AuditService } from '../audit/audit.service';

@ApiTags('cash')
@Controller('cash')
export class CashController {
  constructor(
    private cashService: CashService,
    private auditService: AuditService,
  ) {}

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

  /**
   * 🔧 FIX: Endpoint для получения статистики кассы через SQL агрегацию
   * Это решает проблему с limit=10000 и 502 ошибками
   * 
   * Возвращает: totalIncome, totalExpense, balance, incomeCount, expenseCount
   */
  @Get('stats')
  @UseGuards(CookieJwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR, UserRole.MASTER, UserRole.OPERATOR)
  @ApiOperation({ summary: 'Get cash statistics (aggregated on server)' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getCashStats(
    @Query('cityId') cityId?: string,
    @Query('type') type?: 'income' | 'expense',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Request() req?: { user: RequestUser }
  ) {
    return this.cashService.getCashStats(req.user, {
      cityId: cityId ? Number(cityId) : undefined,
      type,
      startDate,
      endDate,
    });
  }

  /**
   * 🔧 FIX: Endpoint для получения статистики по городам через SQL агрегацию
   * Группирует транзакции по городам и считает income/expense для каждого
   * Используется в админке вместо загрузки всех транзакций с limit=10000
   */
  @Get('stats/by-city')
  @UseGuards(CookieJwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @ApiOperation({ summary: 'Get cash statistics grouped by city' })
  @ApiResponse({ status: 200, description: 'City statistics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getCashStatsByCity(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Request() req?: { user: RequestUser }
  ) {
    return this.cashService.getCashStatsByCity(req.user, { startDate, endDate });
  }

  @Get()
  @UseGuards(CookieJwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR, UserRole.MASTER, UserRole.OPERATOR)
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
  @UseGuards(CookieJwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR, UserRole.MASTER, UserRole.OPERATOR)
  @ApiOperation({ summary: 'Get cash transaction by ID with IDOR protection' })
  @ApiResponse({ status: 200, description: 'Transaction retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Access denied' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async getCashTransaction(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: { user: RequestUser }
  ) {
    const transaction = await this.cashService.getCashTransaction(id);

    if (req.user.role === UserRole.ADMIN) {
      return transaction;
    }

    if (req.user.role === UserRole.DIRECTOR) {
      if (
        req.user.cityIds &&
        req.user.cityIds.length > 0 &&
        !req.user.cityIds.includes(transaction.data.cityId)
      ) {
        throw new ForbiddenException('У вас нет доступа к этой транзакции');
      }
      return transaction;
    }

    if (transaction.data.nameCreate !== req.user.name) {
      throw new ForbiddenException('У вас нет доступа к этой транзакции');
    }

    return transaction;
  }

  @Post()
  @UseGuards(CookieJwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR, UserRole.MASTER, UserRole.OPERATOR)
  @ApiOperation({ summary: 'Create cash transaction with validation' })
  @ApiResponse({ status: 201, description: 'Transaction created successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request - Validation failed' })
  async createCash(
    @Body() dto: CreateCashDto,
    @Request() req: { user: RequestUser; headers: any },
    @Ip() ip: string
  ) {
    const result = await this.cashService.createCash(dto, req.user);

    const userAgent = req.headers['user-agent'] || 'Unknown';
    const auditPromise = dto.type === 'income'
      ? this.auditService.logCashIncome(
          result.data.id,
          req.user.userId,
          req.user.role,
          req.user.login,
          ip,
          userAgent,
          dto.amount.toString(),
          String(dto.cityId ?? '')
        )
      : this.auditService.logCashExpense(
          result.data.id,
          req.user.userId,
          req.user.role,
          req.user.login,
          ip,
          userAgent,
          dto.amount.toString(),
          String(dto.cityId ?? '')
        );

    auditPromise.catch(err => console.error('Audit log failed:', err.message));

    return result;
  }

  @Put(':id')
  @UseGuards(CookieJwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR, UserRole.MASTER, UserRole.OPERATOR)
  @ApiOperation({ summary: 'Update cash transaction with IDOR protection' })
  @ApiResponse({ status: 200, description: 'Transaction updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Access denied' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async updateCash(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCashDto,
    @Request() req: { user: RequestUser; headers: any },
    @Ip() ip: string
  ) {
    // 🔒 IDOR Protection: Проверяем права перед обновлением
    const transaction = await this.cashService.getCashTransaction(id);
    
    // Мастер может обновлять только свои транзакции
    if (req.user.role === UserRole.MASTER && transaction.data.nameCreate !== req.user.name) {
      throw new ForbiddenException('У вас нет прав на обновление этой транзакции');
    }

    // 🔧 OPTIMIZED: Передаём загруженную транзакцию чтобы избежать двойного запроса
    const result = await this.cashService.updateCash(id, dto, req.user, transaction.data);
    
    // 🔧 OPTIMIZED: Логируем асинхронно без await для ускорения ответа
    const userAgent = req.headers['user-agent'] || 'Unknown';
    this.auditService.logCashUpdate(
      id,
      req.user.userId,
      req.user.role,
      req.user.login,
      ip,
      userAgent,
      dto
    ).catch(err => console.error('Audit log failed:', err.message));
    
    return result;
  }

  @Delete(':id')
  @UseGuards(CookieJwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: 'Delete cash transaction with IDOR protection' })
  @ApiResponse({ status: 200, description: 'Transaction deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Access denied' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async deleteCash(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: { user: RequestUser; headers: any },
    @Ip() ip: string
  ) {
    // 🔒 IDOR Protection: Проверяем существование перед удалением
    const transaction = await this.cashService.getCashTransaction(id);
    
    // 🔧 OPTIMIZED: Передаём загруженную транзакцию чтобы избежать двойного запроса
    const result = await this.cashService.deleteCash(id, transaction.data);
    
    // 🔧 OPTIMIZED: Логируем асинхронно без await для ускорения ответа
    const userAgent = req.headers['user-agent'] || 'Unknown';
    this.auditService.logCashDelete(
      id,
      req.user.userId,
      req.user.role,
      req.user.login,
      ip,
      userAgent
    ).catch(err => console.error('Audit log failed:', err.message));
    
    return result;
  }

}














