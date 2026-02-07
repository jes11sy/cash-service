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

export interface CityStats {
  city: string;
  income: number;
  expenses: number;
  balance: number;
}

@Injectable()
export class CashService {
  private readonly logger = new Logger(CashService.name);

  constructor(private prisma: PrismaService) {}

  async getCashTransactions(query: GetCashQueryDto, user: RequestUser) {
    const { name, city, type, paymentPurpose, startDate, endDate, page = 1, limit = 50 } = query;

    const where: any = {};

    // Фильтрация по типу транзакции (приход/расход) через параметр type
    if (type) {
      where.name = type;
    }

    // Фильтрация по названию (для обратной совместимости)
    if (name) {
      where.name = name;
    }

    // Фильтрация по назначению платежа (например, 'Штраф')
    if (paymentPurpose) {
      where.paymentPurpose = paymentPurpose;
    }

    // 🔧 FIX: Добавлена фильтрация по дате
    if (startDate || endDate) {
      where.dateCreate = {};
      if (startDate) {
        where.dateCreate.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.dateCreate.lte = end;
      }
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

    // 🔧 FIX: Используем executeWithRetry для автоматического переподключения при stale connection
    // Это решает проблему 502 ошибок после простоя
    return this.prisma.executeWithRetry(async () => {
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
    });
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
            receiptDocs: dto.receiptDocs || [], // Массив чеков для расходов
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

  /**
   * 🔧 OPTIMIZED: Обновление транзакции с проверкой прав
   * Принимает опциональный existingTransaction чтобы избежать двойного запроса к БД
   */
  async updateCash(id: number, dto: UpdateCashDto, user: RequestUser, existingTransaction?: any) {
    // Используем переданную транзакцию или загружаем из БД
    const transaction = existingTransaction || await this.prisma.cash.findUnique({
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
          ...(dto.receiptDocs !== undefined && { receiptDocs: dto.receiptDocs }), // Массив чеков
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

  /**
   * 🔧 OPTIMIZED: Удаление транзакции
   * Принимает опциональный existingTransaction чтобы избежать двойного запроса к БД
   */
  async deleteCash(id: number, existingTransaction?: any) {
    // Используем переданную транзакцию или проверяем существование
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

    // 🔧 FIX: Используем executeWithRetry для автоматического переподключения при stale connection
    // Это решает проблему 502 ошибок после простоя
    return this.prisma.executeWithRetry(async () => {
      // 🔧 OPTIMIZED: Используем один groupBy запрос вместо двух aggregate
      const groupedStats = await this.prisma.cash.groupBy({
        by: ['name'],
        where,
        _sum: { amount: true },
        _count: { id: true },
      });

      // Преобразуем результат groupBy в удобный формат
      let totalIncome = 0;
      let totalExpense = 0;
      let incomeCount = 0;
      let expenseCount = 0;

      for (const stat of groupedStats) {
        if (stat.name === 'приход') {
          totalIncome = Number(stat._sum.amount || 0);
          incomeCount = stat._count.id;
        } else if (stat.name === 'расход') {
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

  /**
   * 🔧 FIX: Получить статистику кассы сгруппированную по городам
   * Используется в админке вместо загрузки всех транзакций
   * 
   * Фильтры:
   * - startDate/endDate: фильтр по дате
   */
  async getCashStatsByCity(
    user: RequestUser,
    filters?: {
      startDate?: string;
      endDate?: string;
    }
  ): Promise<{ success: true; data: { cities: CityStats[]; totals: CashStats } }> {
    // Базовые условия фильтрации
    const where: any = {};

    // Фильтрация по городам пользователя (для директоров и не-админов)
    if (user.role !== 'admin' && user.cities && user.cities.length > 0) {
      where.city = { in: user.cities };
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

    return this.prisma.executeWithRetry(async () => {
      // Группируем по городу и типу транзакции
      const groupedStats = await this.prisma.cash.groupBy({
        by: ['city', 'name'],
        where,
        _sum: { amount: true },
        _count: { id: true },
      });

      // Преобразуем результат в удобный формат по городам
      const cityMap = new Map<string, CityStats>();
      let totalIncome = 0;
      let totalExpense = 0;
      let incomeCount = 0;
      let expenseCount = 0;

      for (const stat of groupedStats) {
        const city = stat.city || 'Не указан';
        if (!cityMap.has(city)) {
          cityMap.set(city, { city, income: 0, expenses: 0, balance: 0 });
        }

        const cityData = cityMap.get(city)!;
        const amount = Number(stat._sum.amount || 0);

        if (stat.name === 'приход') {
          cityData.income += amount;
          totalIncome += amount;
          incomeCount += stat._count.id;
        } else if (stat.name === 'расход') {
          cityData.expenses += amount;
          totalExpense += amount;
          expenseCount += stat._count.id;
        }
      }

      // Рассчитываем баланс для каждого города
      for (const cityData of cityMap.values()) {
        cityData.balance = cityData.income - cityData.expenses;
      }

      const cities = Array.from(cityMap.values()).sort((a, b) => a.city.localeCompare(b.city));

      this.logger.log(`User ${user.userId} fetched cash stats by city: ${cities.length} cities`);

      return {
        success: true,
        data: {
          cities,
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




