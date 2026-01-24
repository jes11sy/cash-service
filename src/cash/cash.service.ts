import { Injectable, NotFoundException, ForbiddenException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
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

@Injectable()
export class CashService {
  private readonly logger = new Logger(CashService.name);

  constructor(private prisma: PrismaService) {}

  async getCashTransactions(query: GetCashQueryDto, user: RequestUser) {
    const { name, city, type, page = 1, limit = 50 } = query;

    const where: any = {};

    // Фильтрация по типу транзакции (приход/расход) через параметр type
    if (type) {
      where.name = type;
    }

    // Фильтрация по названию (для обратной совместимости)
    if (name) {
      where.name = name;
    }

    // Фильтрация по городам пользователя (для директоров и не-админов)
    if (user.role !== 'admin' && user.cities && user.cities.length > 0) {
      // Если передан параметр city, проверяем, что он входит в список городов пользователя
      if (city) {
        if (user.cities.includes(city)) {
          where.city = city;
        } else {
          // Если пользователь пытается получить данные не из своего города - возвращаем пустой результат
          where.city = null;
        }
      } else {
        // Если city не передан, показываем все города пользователя
        where.city = {
          in: user.cities
        };
      }
    } else if (city) {
      // Для админов - просто применяем фильтр по городу если он передан
      where.city = city;
    }

    // Пагинация
    const skip = (page - 1) * limit;

    try {
      const [transactions, total] = await Promise.all([
        this.prisma.cash.findMany({
          where,
          orderBy: { dateCreate: 'desc' },
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
    } catch (error) {
      this.logger.error(`Error fetching cash transactions: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getCashTransaction(id: number) {
    const transaction = await this.prisma.cash.findUnique({
      where: { id },
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
    // Валидация суммы на уровне сервиса (дополнительная проверка)
    if (dto.amount <= 0 || dto.amount > 9999999.99) {
      throw new BadRequestException('Недопустимая сумма транзакции');
    }

    // Проверка прав доступа к городу (для не-админов)
    const city = dto.city || 'Москва';
    if (user.role !== 'admin' && user.cities && user.cities.length > 0) {
      if (!user.cities.includes(city)) {
        throw new ForbiddenException(`У вас нет доступа к городу ${city}`);
      }
    }

    try {
      // Создаем новую запись (без проверки дубликатов - разрешаем множественные транзакции)
      const result = await this.prisma.$transaction(async (tx) => {
        const transaction = await tx.cash.create({
          data: {
            name: dto.name,
            amount: dto.amount,
            city,
            note: dto.note,
            receiptDoc: dto.receiptDoc,
            paymentPurpose: dto.paymentPurpose,
            nameCreate: user.name,
          },
        });

        return transaction;
      });

      this.logger.log(
        `User ${user.userId} (${user.name}) created cash transaction: ${dto.name} ${dto.amount} RUB`
      );

      return {
        success: true,
        message: 'Cash transaction created successfully',
        data: result,
      };
    } catch (error) {
      // Логируем ошибку с деталями (но без чувствительных данных)
      this.logger.error(
        `Failed to create cash transaction for user ${user.userId}: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  async updateCash(id: number, dto: UpdateCashDto, user: RequestUser) {
    const transaction = await this.prisma.cash.findUnique({
      where: { id },
    });

    if (!transaction) {
      throw new NotFoundException('Cash transaction not found');
    }

    // Проверка прав доступа (для не-админов)
    if (user.role !== 'admin' && user.cities && user.cities.length > 0) {
      // Проверяем, что текущий город транзакции доступен пользователю
      if (!user.cities.includes(transaction.city)) {
        throw new ForbiddenException('У вас нет доступа к этой транзакции');
      }
      // Если меняется город, проверяем, что новый город тоже доступен
      if (dto.city && !user.cities.includes(dto.city)) {
        throw new ForbiddenException(`У вас нет доступа к городу ${dto.city}`);
      }
    }

    // Дополнительная валидация суммы
    if (dto.amount !== undefined && (dto.amount <= 0 || dto.amount > 9999999.99)) {
      throw new BadRequestException('Недопустимая сумма транзакции');
    }

    try {
      const updated = await this.prisma.cash.update({
        where: { id },
        data: {
          ...(dto.amount !== undefined && { amount: dto.amount }),
          ...(dto.name && { name: dto.name }),
          ...(dto.city && { city: dto.city }),
          ...(dto.note !== undefined && { note: dto.note }),
          ...(dto.receiptDoc && { receiptDoc: dto.receiptDoc }),
          ...(dto.paymentPurpose && { paymentPurpose: dto.paymentPurpose }),
        },
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

  async deleteCash(id: number) {
    const transaction = await this.prisma.cash.findUnique({
      where: { id },
    });

    if (!transaction) {
      throw new NotFoundException('Cash transaction not found');
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

  /**
   * 🔧 FIX: Получить статистику кассы через SQL агрегацию
   * Это намного быстрее чем загрузка 10000 записей и подсчет на клиенте
   * 
   * Фильтры:
   * - city: фильтр по городу
   * - type: 'приход' или 'расход' (опционально)
   * - startDate/endDate: фильтр по дате
   */
  async getCashStats(
    user: RequestUser,
    filters?: {
      city?: string;
      type?: 'приход' | 'расход';
      startDate?: string;
      endDate?: string;
    }
  ): Promise<{ success: true; data: CashStats }> {
    // Базовые условия фильтрации
    const where: any = {};

    // Фильтрация по городам пользователя (для директоров и не-админов)
    if (user.role !== 'admin' && user.cities && user.cities.length > 0) {
      if (filters?.city) {
        if (user.cities.includes(filters.city)) {
          where.city = filters.city;
        } else {
          // Пользователь запрашивает не свой город - возвращаем нули
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
        where.city = { in: user.cities };
      }
    } else if (filters?.city) {
      where.city = filters.city;
    }

    // Фильтр по дате
    if (filters?.startDate || filters?.endDate) {
      where.dateCreate = {};
      if (filters.startDate) {
        where.dateCreate.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999);
        where.dateCreate.lte = endDate;
      }
    }

    try {
      // 🔧 Используем SQL агрегацию вместо загрузки всех записей
      const [incomeStats, expenseStats] = await Promise.all([
        this.prisma.cash.aggregate({
          where: { ...where, name: 'приход' },
          _sum: { amount: true },
          _count: { id: true },
        }),
        this.prisma.cash.aggregate({
          where: { ...where, name: 'расход' },
          _sum: { amount: true },
          _count: { id: true },
        }),
      ]);

      const totalIncome = Number(incomeStats._sum.amount || 0);
      const totalExpense = Number(expenseStats._sum.amount || 0);

      const stats: CashStats = {
        totalIncome,
        totalExpense,
        balance: totalIncome - totalExpense,
        incomeCount: incomeStats._count.id,
        expenseCount: expenseStats._count.id,
      };

      this.logger.log(`User ${user.userId} fetched cash stats: income=${totalIncome}, expense=${totalExpense}`);

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      this.logger.error(`Error fetching cash stats: ${error.message}`, error.stack);
      throw error;
    }
  }

}




