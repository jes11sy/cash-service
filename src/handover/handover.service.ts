import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHandoverDto, ApproveHandoverDto } from './dto/handover.dto';

@Injectable()
export class HandoverService {
  constructor(private prisma: PrismaService) {}

  async getHandovers(query: any, user: any) {
    const { status, masterId, period } = query;

    const where: any = {};

    // Если это мастер - показываем только его сдачи
    if (user.role === 'MASTER') {
      where.masterId = user.userId;
    }

    // Если директор может фильтровать по мастеру
    if (user.role === 'DIRECTOR' && masterId) {
      where.masterId = +masterId;
    }

    if (status) {
      where.status = status;
    }

    if (period) {
      where.period = period;
    }

    const handovers = await this.prisma.masterHandover.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        master: {
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
      data: handovers,
    };
  }

  async getHandover(id: number) {
    const handover = await this.prisma.masterHandover.findUnique({
      where: { id },
      include: {
        master: {
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

    if (!handover) {
      throw new NotFoundException('Handover not found');
    }

    return {
      success: true,
      data: handover,
    };
  }

  async createHandover(dto: CreateHandoverDto, user: any) {
    const handover = await this.prisma.masterHandover.create({
      data: {
        masterId: user.userId,
        period: dto.period,
        periodStart: new Date(dto.periodStart),
        periodEnd: new Date(dto.periodEnd),
        totalAmount: dto.totalAmount,
        totalOrders: dto.totalOrders,
        status: 'pending',
        note: dto.note,
      },
      include: {
        master: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return {
      success: true,
      message: 'Handover created successfully',
      data: handover,
    };
  }

  async submitHandover(id: number) {
    const handover = await this.prisma.masterHandover.findUnique({
      where: { id },
    });

    if (!handover) {
      throw new NotFoundException('Handover not found');
    }

    if (handover.status !== 'pending') {
      throw new ForbiddenException('Handover already submitted');
    }

    const updated = await this.prisma.masterHandover.update({
      where: { id },
      data: {
        status: 'submitted',
        submittedDate: new Date(),
      },
    });

    return {
      success: true,
      message: 'Handover submitted for approval',
      data: updated,
    };
  }

  async approveHandover(id: number, dto: ApproveHandoverDto, user: any) {
    const handover = await this.prisma.masterHandover.findUnique({
      where: { id },
    });

    if (!handover) {
      throw new NotFoundException('Handover not found');
    }

    if (handover.status !== 'submitted') {
      throw new ForbiddenException('Handover must be submitted first');
    }

    const updated = await this.prisma.masterHandover.update({
      where: { id },
      data: {
        status: dto.status,
        approvedBy: user.userId,
        approvedDate: new Date(),
        note: dto.note || handover.note,
      },
      include: {
        master: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return {
      success: true,
      message: `Handover ${dto.status}`,
      data: updated,
    };
  }
}




