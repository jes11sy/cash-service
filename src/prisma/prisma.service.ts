import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private keepAliveInterval: NodeJS.Timeout | null = null;
  private isReady: boolean = false;

  constructor() {
    // ✅ ОПТИМИЗИРОВАНО: Cash Service - низкая/средняя нагрузка
    const databaseUrl = process.env.DATABASE_URL || '';
    const hasParams = databaseUrl.includes('?');
    
    const connectionParams = [
      'connection_limit=15',
      'pool_timeout=20',
      'connect_timeout=10',
      'socket_timeout=60',
      // ✅ FIX: TCP Keepalive для предотвращения idle-session timeout
      'keepalives=1',
      'keepalives_idle=30',
      'keepalives_interval=10',
      'keepalives_count=3',
    ];
    
    const needsParams = !databaseUrl.includes('connection_limit');
    const enhancedUrl = needsParams
      ? `${databaseUrl}${hasParams ? '&' : '?'}${connectionParams.join('&')}`
      : databaseUrl;

    super({
      datasources: {
        db: { url: enhancedUrl },
      },
      log: ['error', 'warn'],
    });

    if (needsParams) {
      this.logger.log('✅ Connection pool configured with keepalive');
    }
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('✅ Database connected');
      
      // 🔧 FIX: Прогрев соединения - выполняем тестовый запрос к таблице cash
      // Это предотвращает cold start 502 ошибки при первом реальном запросе
      try {
        const warmupStart = Date.now();
        await this.$queryRaw`SELECT 1`;
        // Прогреваем connection pool - делаем легкий запрос к cash
        await this.cash.findFirst({ take: 1 });
        const warmupTime = Date.now() - warmupStart;
        this.logger.log(`✅ Database warmup completed in ${warmupTime}ms`);
        this.isReady = true;
      } catch (warmupError: any) {
        // Если таблица пустая или ошибка - не критично, продолжаем
        this.logger.warn(`⚠️ Database warmup partial: ${warmupError?.message}`);
        this.isReady = true;
      }
      
      // ✅ FIX: Keepalive ping каждые 30 секунд (было 60)
      this.keepAliveInterval = setInterval(async () => {
        try {
          await this.$queryRaw`SELECT 1`;
        } catch (error: any) {
          this.logger.warn(`⚠️ Keepalive ping failed: ${error?.message}`);
          this.isReady = false;
        }
      }, 30000);
    } catch (error) {
      this.logger.error('❌ Failed to connect to database', error);
      throw error;
    }
  }

  /**
   * Проверка готовности сервиса для readiness probe
   */
  async checkHealth(): Promise<{ healthy: boolean; latencyMs: number }> {
    const start = Date.now();
    try {
      await this.$queryRaw`SELECT 1`;
      const latencyMs = Date.now() - start;
      this.isReady = true;
      return { healthy: true, latencyMs };
    } catch (error) {
      this.isReady = false;
      return { healthy: false, latencyMs: Date.now() - start };
    }
  }

  /**
   * Быстрая проверка готовности (без запроса к БД)
   */
  isHealthy(): boolean {
    return this.isReady;
  }

  async onModuleDestroy() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
    }
    await this.$disconnect();
    this.logger.log('✅ Database disconnected');
  }
}





















