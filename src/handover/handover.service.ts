import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HandoverService {
  constructor(private prisma: PrismaService) {}

  async getMasterCashSubmissions(query: any, user: any) {
    const { status } = query;

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

    const orders = await this.prisma.order.findMany({
      where,
      include: {
        master: {
          select: { name: true }
        }
      },
      orderBy: { closingData: 'desc' }
    });

    return {
      success: true,
      data: orders,
    };
  }
}
