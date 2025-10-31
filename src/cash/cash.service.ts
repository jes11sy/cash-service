import { Injectable, NotFoundException, ForbiddenException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCashDto, UpdateCashDto, ApproveCashDto } from './dto/cash.dto';
import { GetCashQueryDto } from './dto/query.dto';
import { RequestUser } from '../auth/interfaces/jwt-payload.interface';

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

    if (city) {
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

    try {
      // Используем транзакцию для предотвращения Race Condition
      const result = await this.prisma.$transaction(async (tx) => {
        // Проверяем дубликаты только для конкретных заказов (формат "Заказ №123")
        // Общие категории ("Заказ", "Депозит" и т.д.) не проверяем
        if (dto.paymentPurpose && /Заказ №\d+/.test(dto.paymentPurpose)) {
          const existing = await tx.cash.findFirst({
            where: { paymentPurpose: dto.paymentPurpose },
          });

          if (existing) {
            // ВАЖНО: Не обновляем автоматически! Это может привести к потере данных
            // Вместо этого возвращаем ошибку конфликта
            throw new ConflictException(
              `Транзакция с назначением платежа "${dto.paymentPurpose}" уже существует (ID: ${existing.id})`
            );
          }
        }

        // Создаем новую запись
        const transaction = await tx.cash.create({
          data: {
            name: dto.name,
            amount: dto.amount,
            city: dto.city || 'Москва',
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

}




