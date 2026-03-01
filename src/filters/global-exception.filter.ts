import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaService } from '../prisma/prisma.service';

// 🔒 SECURITY: Список чувствительных полей для фильтрации из логов
const SENSITIVE_FIELDS = ['password', 'token', 'secret', 'apiKey', 'authorization', 'cookie', 'creditCard', 'cardNumber', 'cvv', 'pin'];

/**
 * 🔒 Фильтрует чувствительные данные из объекта
 */
function sanitizeObject(obj: any, depth = 0): any {
  if (depth > 5 || !obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, depth + 1));
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_FIELDS.some(field => lowerKey.includes(field))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value, depth + 1);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly prisma: PrismaService) {}

  async catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const errorMessage =
      exception instanceof HttpException
        ? exception.message
        : exception instanceof Error
        ? exception.message
        : 'Unknown error';

    const errorType =
      exception instanceof Error ? exception.constructor.name : 'UnknownError';

    const stackTrace =
      exception instanceof Error ? exception.stack : undefined;

    if (status >= 500) {
      try {
        // 🔒 SECURITY: Фильтруем чувствительные данные перед логированием
        await this.prisma.errorCash.create({
          data: {
            errorType,
            errorMessage,
            stackTrace,
            userId: (request as any).user?.userId || null,
            userRole: (request as any).user?.role || null,
            requestUrl: request.url,
            requestMethod: request.method,
            ip: request.ip || (request.headers['x-forwarded-for'] as string) || request.socket?.remoteAddress || null,
            userAgent: request.headers['user-agent'] || null,
            metadata: {
              body: sanitizeObject(request.body),
              params: sanitizeObject(request.params),
              query: sanitizeObject(request.query),
            },
          },
        });
      } catch (dbError) {
        this.logger.error(`🔥 Failed to write error log to DB`, dbError);
      }
    }

    this.logger.error(
      `[cash-service] ${request.method} ${request.url} - ${status} ${errorMessage}`,
      stackTrace,
    );

    response.status(status).send({
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: errorMessage,
    });
  }
}

