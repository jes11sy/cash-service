import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditLogEntry {
  timestamp?: string;
  eventType: string;
  userId?: number;
  role?: string;
  login?: string;
  ip: string;
  userAgent: string;
  success: boolean;
  metadata?: Record<string, any>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Записать событие в audit_logs
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          timestamp: entry.timestamp ? new Date(entry.timestamp) : new Date(),
          eventType: entry.eventType,
          userId: entry.userId,
          role: entry.role,
          login: entry.login,
          ip: entry.ip,
          userAgent: entry.userAgent,
          success: entry.success,
          metadata: entry.metadata || {},
        },
      });
      
      this.logger.log(
        JSON.stringify({
          ...entry,
          timestamp: entry.timestamp || new Date().toISOString(),
        })
      );
    } catch (error) {
      this.logger.error('Failed to write audit log:', error.message);
    }
  }

  /**
   * Логирование создания прихода
   */
  async logCashIncome(
    cashId: number,
    userId: number,
    role: string,
    login: string,
    ip: string,
    userAgent: string,
    amount: string,
    city: string
  ): Promise<void> {
    await this.log({
      eventType: 'cash.income.create',
      userId,
      role,
      login,
      ip,
      userAgent,
      success: true,
      metadata: {
        cashId,
        amount,
        city,
      },
    });
  }

  /**
   * Логирование создания расхода
   */
  async logCashExpense(
    cashId: number,
    userId: number,
    role: string,
    login: string,
    ip: string,
    userAgent: string,
    amount: string,
    city: string
  ): Promise<void> {
    await this.log({
      eventType: 'cash.expense.create',
      userId,
      role,
      login,
      ip,
      userAgent,
      success: true,
      metadata: {
        cashId,
        amount,
        city,
      },
    });
  }

  /**
   * Логирование обновления транзакции
   */
  async logCashUpdate(
    cashId: number,
    userId: number,
    role: string,
    login: string,
    ip: string,
    userAgent: string,
    changes: any
  ): Promise<void> {
    await this.log({
      eventType: 'cash.update',
      userId,
      role,
      login,
      ip,
      userAgent,
      success: true,
      metadata: {
        cashId,
        changes,
      },
    });
  }

  /**
   * Логирование удаления транзакции
   */
  async logCashDelete(
    cashId: number,
    userId: number,
    role: string,
    login: string,
    ip: string,
    userAgent: string
  ): Promise<void> {
    await this.log({
      eventType: 'cash.delete',
      userId,
      role,
      login,
      ip,
      userAgent,
      success: true,
      metadata: {
        cashId,
      },
    });
  }
}

