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

  @Get()
  @UseGuards(CookieJwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.admin, UserRole.director, UserRole.master, UserRole.callcentre_admin, UserRole.callcentre_operator, UserRole.operator)
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
  @Roles(UserRole.admin, UserRole.director, UserRole.master, UserRole.callcentre_admin, UserRole.callcentre_operator, UserRole.operator)
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

    // Мастер и оператор могут видеть только свои транзакции
    if (transaction.data.nameCreate !== req.user.name) {
      throw new ForbiddenException('У вас нет доступа к этой транзакции');
    }

    return transaction;
  }

  @Post()
  @UseGuards(CookieJwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.admin, UserRole.director, UserRole.master, UserRole.operator, UserRole.callcentre_operator, UserRole.callcentre_admin)
  @ApiOperation({ summary: 'Create cash transaction with validation' })
  @ApiResponse({ status: 201, description: 'Transaction created successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request - Validation failed' })
  @ApiResponse({ status: 409, description: 'Conflict - Duplicate payment purpose' })
  async createCash(
    @Body() dto: CreateCashDto,
    @Request() req: { user: RequestUser; headers: any },
    @Ip() ip: string
  ) {
    const result = await this.cashService.createCash(dto, req.user);
    
    // Логируем создание прихода или расхода
    const userAgent = req.headers['user-agent'] || 'Unknown';
    if (dto.name === 'приход') {
      await this.auditService.logCashIncome(
        result.data.id,
        req.user.userId,
        req.user.role,
        req.user.login,
        ip,
        userAgent,
        dto.amount.toString(),
        dto.city || 'Unknown'
      );
    } else if (dto.name === 'расход') {
      await this.auditService.logCashExpense(
        result.data.id,
        req.user.userId,
        req.user.role,
        req.user.login,
        ip,
        userAgent,
        dto.amount.toString(),
        dto.city || 'Unknown'
      );
    }
    
    return result;
  }

  @Put(':id')
  @UseGuards(CookieJwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.admin, UserRole.director, UserRole.master, UserRole.callcentre_admin, UserRole.callcentre_operator, UserRole.operator)
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
    
    if (
      req.user.role !== UserRole.admin &&
      req.user.role !== UserRole.director &&
      req.user.role !== UserRole.callcentre_admin &&
      req.user.role !== UserRole.callcentre_operator &&
      req.user.role !== UserRole.operator &&
      transaction.data.nameCreate !== req.user.name
    ) {
      throw new ForbiddenException('У вас нет прав на обновление этой транзакции');
    }

    const result = await this.cashService.updateCash(id, dto, req.user);
    
    // Логируем обновление
    const userAgent = req.headers['user-agent'] || 'Unknown';
    await this.auditService.logCashUpdate(
      id,
      req.user.userId,
      req.user.role,
      req.user.login,
      ip,
      userAgent,
      dto
    );
    
    return result;
  }

  @Delete(':id')
  @UseGuards(CookieJwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.admin, UserRole.callcentre_admin, UserRole.callcentre_operator, UserRole.operator)
  @ApiOperation({ summary: 'Delete cash transaction with IDOR protection' })
  @ApiResponse({ status: 200, description: 'Transaction deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Access denied' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async deleteCash(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: { user: RequestUser; headers: any },
    @Ip() ip: string
  ) {
    // 🔒 IDOR Protection: Проверяем права перед удалением
    const transaction = await this.cashService.getCashTransaction(id);
    
    // Только админ и операторы КЦ могут удалять транзакции
    if (
      req.user.role !== UserRole.admin &&
      req.user.role !== UserRole.callcentre_admin &&
      req.user.role !== UserRole.callcentre_operator &&
      req.user.role !== UserRole.operator
    ) {
      throw new ForbiddenException('У вас нет прав на удаление этой транзакции');
    }

    const result = await this.cashService.deleteCash(id);
    
    // Логируем удаление
    const userAgent = req.headers['user-agent'] || 'Unknown';
    await this.auditService.logCashDelete(
      id,
      req.user.userId,
      req.user.role,
      req.user.login,
      ip,
      userAgent
    );
    
    return result;
  }

}














