import { Controller, Get, HttpCode, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Health Controller для Kubernetes liveness/readiness probes
 * 
 * 🔧 FIX: Предотвращает 502 ошибки при cold start
 * Kubernetes ждет пока readiness probe пройдет перед отправкой трафика
 */
@ApiTags('health')
@Controller()
export class HealthController {
  constructor(private prisma: PrismaService) {}

  /**
   * Liveness probe - проверяет, что приложение запущено
   * Kubernetes перезапустит pod если этот endpoint не отвечает
   */
  @Get('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Liveness probe' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  liveness() {
    return {
      status: 'ok',
      service: 'cash-service',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Readiness probe - проверяет, что сервис готов принимать трафик
   * Kubernetes не отправляет трафик пока readiness не пройдет
   * 
   * 🔧 FIX: Проверяем соединение с БД чтобы избежать 502 при cold start
   */
  @Get('health/ready')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Readiness probe - checks database connectivity' })
  @ApiResponse({ status: 200, description: 'Service is ready to accept traffic' })
  @ApiResponse({ status: 503, description: 'Service is not ready' })
  async readiness() {
    const dbHealth = await this.prisma.checkHealth();
    
    if (!dbHealth.healthy) {
      throw new ServiceUnavailableException({
        status: 'error',
        service: 'cash-service',
        database: 'disconnected',
        timestamp: new Date().toISOString(),
      });
    }

    return {
      status: 'ok',
      service: 'cash-service',
      database: 'connected',
      dbLatencyMs: dbHealth.latencyMs,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Startup probe - используется для медленно стартующих приложений
   * Kubernetes ждет дольше при первом старте
   */
  @Get('health/startup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Startup probe' })
  @ApiResponse({ status: 200, description: 'Service has started' })
  @ApiResponse({ status: 503, description: 'Service is still starting' })
  async startup() {
    // Быстрая проверка без запроса к БД
    if (!this.prisma.isHealthy()) {
      throw new ServiceUnavailableException({
        status: 'starting',
        service: 'cash-service',
        timestamp: new Date().toISOString(),
      });
    }

    return {
      status: 'ok',
      service: 'cash-service',
      timestamp: new Date().toISOString(),
    };
  }
}
