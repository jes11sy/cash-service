import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCashDto, UpdateCashDto, ApproveCashDto } from './dto/cash.dto';

@Injectable()
export class CashService {
  constructor(private prisma: PrismaService) {}

  async getCashTransactions(query: any, user: any) {
    const { name, city, type } = query;

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

    const transactions = await this.prisma.cash.findMany({
      where,
      orderBy: { dateCreate: 'desc' },
    });

    return {
      success: true,
      data: transactions,
    };
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

  async createCash(dto: CreateCashDto, user: any) {
    const transaction = await this.prisma.cash.create({
      data: {
        name: dto.name,
        amount: dto.amount,
        city: dto.city,
        note: dto.note,
        receiptDoc: dto.receiptDoc,
        paymentPurpose: dto.paymentPurpose,
        nameCreate: user.name || 'Unknown',
      },
    });

    return {
      success: true,
      message: 'Cash transaction created successfully',
      data: transaction,
    };
  }

  async updateCash(id: number, dto: UpdateCashDto) {
    const transaction = await this.prisma.cash.findUnique({
      where: { id },
    });

    if (!transaction) {
      throw new NotFoundException('Cash transaction not found');
    }

    const updated = await this.prisma.cash.update({
      where: { id },
      data: {
        ...(dto.amount && { amount: dto.amount }),
        ...(dto.name && { name: dto.name }),
        ...(dto.city && { city: dto.city }),
        ...(dto.note !== undefined && { note: dto.note }),
        ...(dto.receiptDoc && { receiptDoc: dto.receiptDoc }),
        ...(dto.paymentPurpose && { paymentPurpose: dto.paymentPurpose }),
      },
    });

    return {
      success: true,
      message: 'Cash transaction updated successfully',
      data: updated,
    };
  }

}




