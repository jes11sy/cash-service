import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCashDto, UpdateCashDto, ApproveCashDto } from './dto/cash.dto';

@Injectable()
export class CashService {
  constructor(private prisma: PrismaService) {}

  async getCashTransactions(query: any, user: any) {
    const { status, type, masterId } = query;

    const where: any = {};

    // Если это мастер - показываем только его заявки
    if (user.role === 'MASTER') {
      where.submittedBy = user.userId;
    }

    // Если директор может фильтровать по мастеру
    if (user.role === 'DIRECTOR' && masterId) {
      where.submittedBy = +masterId;
    }

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
    }

    const transactions = await this.prisma.cash.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        order: {
          select: {
            id: true,
            rk: true,
            clientName: true,
            address: true,
            statusOrder: true,
          },
        },
        submitter: {
          select: {
            id: true,
            name: true,
          },
        },
        approver: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return {
      success: true,
      data: transactions,
    };
  }

  async getCashTransaction(id: number) {
    const transaction = await this.prisma.cash.findUnique({
      where: { id },
      include: {
        order: true,
        submitter: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        approver: {
          select: {
            id: true,
            name: true,
          },
        },
      },
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
        orderId: dto.orderId,
        amount: dto.amount,
        type: dto.type,
        status: 'pending',
        submittedBy: user.userId,
        receiptDoc: dto.receiptDoc,
        note: dto.note,
      },
      include: {
        order: {
          select: {
            id: true,
            rk: true,
            clientName: true,
          },
        },
      },
    });

    return {
      success: true,
      message: 'Cash transaction submitted successfully',
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

    if (transaction.status !== 'pending') {
      throw new ForbiddenException('Cannot update approved/rejected transaction');
    }

    const updated = await this.prisma.cash.update({
      where: { id },
      data: {
        ...(dto.amount && { amount: dto.amount }),
        ...(dto.type && { type: dto.type }),
        ...(dto.receiptDoc && { receiptDoc: dto.receiptDoc }),
        ...(dto.note !== undefined && { note: dto.note }),
      },
    });

    return {
      success: true,
      message: 'Cash transaction updated successfully',
      data: updated,
    };
  }

  async approveCash(id: number, dto: ApproveCashDto, user: any) {
    const transaction = await this.prisma.cash.findUnique({
      where: { id },
    });

    if (!transaction) {
      throw new NotFoundException('Cash transaction not found');
    }

    if (transaction.status !== 'pending') {
      throw new ForbiddenException('Transaction already processed');
    }

    const updated = await this.prisma.cash.update({
      where: { id },
      data: {
        status: dto.status,
        approvedBy: user.userId,
        approvedDate: new Date(),
        note: dto.note || transaction.note,
      },
      include: {
        order: true,
        submitter: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return {
      success: true,
      message: `Cash transaction ${dto.status}`,
      data: updated,
    };
  }

  async getMasterBalance(masterId: number) {
    const transactions = await this.prisma.cash.findMany({
      where: {
        submittedBy: masterId,
        status: 'approved',
      },
    });

    const totalApproved = transactions.reduce((sum, t) => sum + t.amount, 0);
    const totalPending = await this.prisma.cash
      .aggregate({
        where: {
          submittedBy: masterId,
          status: 'pending',
        },
        _sum: {
          amount: true,
        },
      })
      .then((res) => res._sum.amount || 0);

    return {
      success: true,
      data: {
        masterId,
        totalApproved,
        totalPending,
        transactions: transactions.length,
      },
    };
  }
}

