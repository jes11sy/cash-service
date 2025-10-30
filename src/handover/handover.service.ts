import { Injectable, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GetHandoverQueryDto } from '../cash/dto/query.dto';
import { RequestUser } from '../auth/interfaces/jwt-payload.interface';

@Injectable()
export class HandoverService {
  private readonly logger = new Logger(HandoverService.name);

  constructor(private prisma: PrismaService) {}

  async getMasterCashSubmissions(query: GetHandoverQueryDto, user: RequestUser) {
    const { status, page = 1, limit = 50 } = query;

    // Получаем ID мастера из JWT токена
    const masterId = user?.userId;
    
    if (!masterId) {
      throw new ForbiddenException('Master ID not found in token');
    }

    const where: any = {
      masterId,
      statusOrder: 'Готово',
    };

    // Фильтр по статусу сдачи
    if (status && status !== 'all') {
      where.cashSubmissionStatus = status;
    } else {
      // Показываем только русские статусы, исключаем not_submitted и null
      where.cashSubmissionStatus = { in: ['Не отправлено', 'На проверке', 'Одобрено', 'Отклонено'] };
    }

    // Пагинация
    const skip = (page - 1) * limit;

    try {
      const [orders, total] = await Promise.all([
        this.prisma.order.findMany({
          where,
          include: {
            master: {
              select: { name: true }
            }
          },
          orderBy: { closingData: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.order.count({ where }),
      ]);

      this.logger.log(`Master ${masterId} fetched ${orders.length} cash submissions`);

      return {
        success: true,
        data: orders,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error(
        `Error fetching cash submissions for master ${masterId}: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }
}
