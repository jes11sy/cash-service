import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCashDto, UpdateCashDto, ApproveCashDto } from './dto/cash.dto';
import { GetCashQueryDto } from './dto/query.dto';
import { RequestUser } from '../auth/interfaces/jwt-payload.interface';

export interface CashStats {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  incomeCount: number;
  expenseCount: number;
}

export interface CityStats {
  cityId: number;
  cityName: string;
  income: number;
  expenses: number;
  balance: number;
}

@Injectable()
export class CashService {
  private readonly logger = new Logger(CashService.name);

  constructor(private prisma: PrismaService) {}

  async getCashTransactions(query: GetCashQueryDto, user: RequestUser) {
    const { cityId, type, paymentPurpose, startDate, endDate, page = 1, limit = 50 } = query;

    const where: any = {};

    if (type) {
      where.type = type;
    }

    if (paymentPurpose) {
      where.paymentPurpose = paymentPurpose;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    if (user.role !== 'admin' && user.cityIds && user.cityIds.length > 0) {
      if (cityId) {
        if (user.cityIds.includes(cityId)) {
          where.cityId = cityId;
        } else {
          where.cityId = -1;
        }
      } else {
        where.cityId = { in: user.cityIds };
      }
    } else if (cityId) {
      where.cityId = cityId;
    }

    const skip = (page - 1) * limit;

    return this.prisma.executeWithRetry(async () => {
      const [transactions, total] = await Promise.all([
        this.prisma.cash.findMany({
          where,
          include: { city: true },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.cash.count({ where }),
      ]);

      this.logger.log(`User ${user.userId} fetched ${transactions.length} cash transactions`);

      return {
        success: true,
        data: transactions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    });
  }

  async getCashTransaction(id: number) {
    const transaction = await this.prisma.cash.findUnique({
      where: { id },
      include: { city: true },
    });

    if (!transaction) {
      throw new NotFoundException('Cash transaction not found');
    }

    return {
      success: true,
      data: transaction,
    };
  }

  async createCash(dto: CreateCashDto, user: RequestUser) {
    if (dto.amount <= 0 || dto.amount > 9999999.99) {
      throw new BadRequestException('Недопустимая сумма транзакции');
    }

    if (dto.cityId && user.role !== 'admin' && user.cityIds && user.cityIds.length > 0) {
      if (!user.cityIds.includes(dto.cityId)) {
        throw new ForbiddenException(`У вас нет доступа к данному городу`);
      }
    }

    const cityId = dto.cityId ?? (user.cityIds?.[0] ?? null);

    if (!cityId) {
      throw new BadRequestException('Необходимо указать cityId');
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const transaction = await tx.cash.create({
          data: {
            type: dto.type,
            amount: dto.amount,
            cityId,
            note: dto.note,
            receiptDocs: dto.receiptDocs || [],
            paymentPurpose: dto.paymentPurpose,
            nameCreate: user.name,
          },
          include: { city: true },
        });

        return transaction;
      });

      this.logger.log(
        `User ${user.userId} (${user.name}) created cash transaction: ${dto.type} ${dto.amount} RUB`
      );

      return {
        success: true,
        message: 'Cash transaction created successfully',
        data: result,
      };
    } catch (error) {
      this.logger.error(
        `Failed to create cash transaction for user ${user.userId}: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  async updateCash(id: number, dto: UpdateCashDto, user: RequestUser, existingTransaction?: any) {
    const transaction = existingTransaction || await this.prisma.cash.findUnique({
      where: { id },
    });

    if (!transaction) {
      throw new NotFoundException('Cash transaction not found');
    }

    if (user.role !== 'admin' && user.cityIds && user.cityIds.length > 0) {
      if (!user.cityIds.includes(transaction.cityId)) {
        throw new ForbiddenException('У вас нет доступа к этой транзакции');
      }
      if (dto.cityId !== undefined && !user.cityIds.includes(dto.cityId)) {
        throw new ForbiddenException(`У вас нет доступа к данному городу`);
      }
    }

    if (dto.amount !== undefined && (dto.amount <= 0 || dto.amount > 9999999.99)) {
      throw new BadRequestException('Недопустимая сумма транзакции');
    }

    try {
      const updated = await this.prisma.cash.update({
        where: { id },
        data: {
          ...(dto.amount !== undefined && { amount: dto.amount }),
          ...(dto.type && { type: dto.type }),
          ...(dto.cityId !== undefined && { cityId: dto.cityId }),
          ...(dto.note !== undefined && { note: dto.note }),
          ...(dto.receiptDocs !== undefined && { receiptDocs: dto.receiptDocs }),
          ...(dto.paymentPurpose && { paymentPurpose: dto.paymentPurpose }),
        },
        include: { city: true },
      });

      this.logger.log(
        `User ${user.userId} (${user.name}) updated cash transaction ${id}`
      );

      return {
        success: true,
        message: 'Cash transaction updated successfully',
        data: updated,
      };
    } catch (error) {
      this.logger.error(
        `Failed to update cash transaction ${id} by user ${user.userId}: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  async deleteCash(id: number, existingTransaction?: any) {
    if (!existingTransaction) {
      const transaction = await this.prisma.cash.findUnique({
        where: { id },
      });

      if (!transaction) {
        throw new NotFoundException('Cash transaction not found');
      }
    }

    try {
      await this.prisma.cash.delete({
        where: { id },
      });

      this.logger.log(`Cash transaction ${id} deleted successfully`);

      return {
        success: true,
        message: 'Cash transaction deleted successfully',
      };
    } catch (error) {
      this.logger.error(
        `Failed to delete cash transaction ${id}: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  async getCashStats(
    user: RequestUser,
    filters?: {
      cityId?: number;
      type?: 'income' | 'expense';
      startDate?: string;
      endDate?: string;
    }
  ): Promise<{ success: true; data: CashStats }> {
    const where: any = {};

    if (user.role !== 'admin' && user.cityIds && user.cityIds.length > 0) {
      if (filters?.cityId) {
        if (user.cityIds.includes(filters.cityId)) {
          where.cityId = filters.cityId;
        } else {
          return {
            success: true,
            data: {
              totalIncome: 0,
              totalExpense: 0,
              balance: 0,
              incomeCount: 0,
              expenseCount: 0,
            },
          };
        }
      } else {
        where.cityId = { in: user.cityIds };
      }
    } else if (filters?.cityId) {
      where.cityId = filters.cityId;
    }

    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = endDate;
      }
    }

    return this.prisma.executeWithRetry(async () => {
      const groupedStats = await this.prisma.cash.groupBy({
        by: ['type'],
        where,
        _sum: { amount: true },
        _count: { id: true },
      });

      let totalIncome = 0;
      let totalExpense = 0;
      let incomeCount = 0;
      let expenseCount = 0;

      for (const stat of groupedStats) {
        if (stat.type === 'income') {
          totalIncome = Number(stat._sum.amount || 0);
          incomeCount = stat._count.id;
        } else if (stat.type === 'expense') {
          totalExpense = Number(stat._sum.amount || 0);
          expenseCount = stat._count.id;
        }
      }

      const stats: CashStats = {
        totalIncome,
        totalExpense,
        balance: totalIncome - totalExpense,
        incomeCount,
        expenseCount,
      };

      this.logger.log(`User ${user.userId} fetched cash stats: income=${totalIncome}, expense=${totalExpense}`);

      return {
        success: true,
        data: stats,
      };
    });
  }

  async getCashStatsByCity(
    user: RequestUser,
    filters?: {
      startDate?: string;
      endDate?: string;
    }
  ): Promise<{ success: true; data: { cities: CityStats[]; totals: CashStats } }> {
    const where: any = {};

    if (user.role !== 'admin' && user.cityIds && user.cityIds.length > 0) {
      where.cityId = { in: user.cityIds };
    }

    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = endDate;
      }
    }

    return this.prisma.executeWithRetry(async () => {
      const groupedStats = await this.prisma.cash.groupBy({
        by: ['cityId', 'type'],
        where,
        _sum: { amount: true },
        _count: { id: true },
      });

      const cityIds = [...new Set(groupedStats.map((s) => s.cityId))];
      const cities = await this.prisma.city.findMany({
        where: { id: { in: cityIds } },
        select: { id: true, name: true },
      });
      const cityNameMap = new Map(cities.map((c) => [c.id, c.name]));

      const cityMap = new Map<number, CityStats>();
      let totalIncome = 0;
      let totalExpense = 0;
      let incomeCount = 0;
      let expenseCount = 0;

      for (const stat of groupedStats) {
        const id = stat.cityId;
        if (!cityMap.has(id)) {
          cityMap.set(id, {
            cityId: id,
            cityName: cityNameMap.get(id) ?? String(id),
            income: 0,
            expenses: 0,
            balance: 0,
          });
        }

        const cityData = cityMap.get(id)!;
        const amount = Number(stat._sum.amount || 0);

        if (stat.type === 'income') {
          cityData.income += amount;
          totalIncome += amount;
          incomeCount += stat._count.id;
        } else if (stat.type === 'expense') {
          cityData.expenses += amount;
          totalExpense += amount;
          expenseCount += stat._count.id;
        }
      }

      for (const cityData of cityMap.values()) {
        cityData.balance = cityData.income - cityData.expenses;
      }

      const citiesResult = Array.from(cityMap.values()).sort((a, b) =>
        a.cityName.localeCompare(b.cityName)
      );

      this.logger.log(`User ${user.userId} fetched cash stats by city: ${citiesResult.length} cities`);

      return {
        success: true,
        data: {
          cities: citiesResult,
          totals: {
            totalIncome,
            totalExpense,
            balance: totalIncome - totalExpense,
            incomeCount,
            expenseCount,
          },
        },
      };
    });
  }
}
