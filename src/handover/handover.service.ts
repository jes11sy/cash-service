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

    const masterId = user?.userId;

    if (!masterId) {
      throw new ForbiddenException('Master ID not found in token');
    }

    const cashSubmissionWhere: any = {
      order: {
        masterId,
      },
    };

    if (status && status !== 'all') {
      cashSubmissionWhere.status = status;
    }

    const skip = (page - 1) * limit;

    try {
      const [submissions, total] = await Promise.all([
        this.prisma.cashSubmission.findMany({
          where: cashSubmissionWhere,
          include: {
            order: {
              select: {
                id: true,
                cityId: true,
                phone: true,
                clientName: true,
                address: true,
                result: true,
                expenditure: true,
                clean: true,
                masterChange: true,
                closingAt: true,
              },
            },
          },
          orderBy: { submittedAt: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.cashSubmission.count({ where: cashSubmissionWhere }),
      ]);

      this.logger.log(`Master ${masterId} fetched ${submissions.length} cash submissions`);

      return {
        success: true,
        data: submissions,
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
