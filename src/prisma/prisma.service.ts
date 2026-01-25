import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private keepAliveInterval: NodeJS.Timeout | null = null;
  private isReady: boolean = false;
  private reconnectAttempts: number = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 3;

  constructor() {
    // ✅ ОПТИМИЗИРОВАНО: Cash Service - низкая/средняя нагрузка
    const databaseUrl = process.env.DATABASE_URL || '';
    const hasParams = databaseUrl.includes('?');
    
    // 🔧 FIX: Более агрессивные настройки для предотвращения 502
    const connectionParams = [
      'connection_limit=15',
      'pool_timeout=30',           // Увеличен таймаут пула
      'connect_timeout=15',        // Увеличен таймаут подключения
      'socket_timeout=120',        // Увеличен socket timeout
      // ✅ FIX: Более агрессивный TCP Keepalive
      'keepalives=1',
      'keepalives_idle=15',        // Было 30, теперь 15 секунд
      'keepalives_interval=5',     // Было 10, теперь 5 секунд
      'keepalives_count=5',        // Было 3, теперь 5 попыток
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
      this.logger.log('✅ Connection pool configured with aggressive keepalive');
    }
  }

  /**
   * 🔧 FIX: Выполнить запрос с автоматическим переподключением при stale connection
   * Это решает проблему 502 ошибок после простоя
   */
  async executeWithRetry<T>(operation: () => Promise<T>, maxRetries = 2): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        
        // Проверяем, является ли ошибка связанной с соединением
        const isConnectionError = 
          error.code === 'P1001' || // Can't reach database server
          error.code === 'P1002' || // Database server timeout
          error.code === 'P1008' || // Operations timed out
          error.code === 'P1017' || // Server closed connection
          error.code === 'P2024' || // Pool timeout
          error.message?.includes('Connection') ||
          error.message?.includes('ECONNRESET') ||
          error.message?.includes('ETIMEDOUT') ||
          error.message?.includes('socket hang up');
        
        if (isConnectionError && attempt < maxRetries) {
          this.logger.warn(`⚠️ Connection error on attempt ${attempt + 1}, reconnecting... Error: ${error.message}`);
          
          try {
            // Переподключаемся
            await this.$disconnect();
            await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1))); // Экспоненциальная задержка
            await this.$connect();
            this.logger.log('✅ Reconnected to database');
            
            // Прогреваем соединение
            await this.$queryRaw`SELECT 1`;
            continue;
          } catch (reconnectError: any) {
            this.logger.error(`❌ Reconnect failed: ${reconnectError.message}`);
          }
        }
        
        // Для не-connection ошибок или последней попытки - пробрасываем
        throw error;
      }
    }
    
    throw lastError;
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
      
      // ✅ FIX: Keepalive ping каждые 15 секунд (было 30) для агрессивного поддержания соединения
      this.keepAliveInterval = setInterval(async () => {
        try {
          await this.$queryRaw`SELECT 1`;
          this.reconnectAttempts = 0; // Сбрасываем счетчик при успехе
        } catch (error: any) {
          this.logger.warn(`⚠️ Keepalive ping failed: ${error?.message}`);
          this.reconnectAttempts++;
          
          // 🔧 FIX: Автоматическое переподключение при проблемах с keepalive
          if (this.reconnectAttempts <= this.MAX_RECONNECT_ATTEMPTS) {
            try {
              this.logger.log(`🔄 Attempting reconnect (${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})...`);
              await this.$disconnect();
              await new Promise(resolve => setTimeout(resolve, 1000));
              await this.$connect();
              await this.$queryRaw`SELECT 1`;
              this.logger.log('✅ Reconnected successfully');
              this.isReady = true;
              this.reconnectAttempts = 0;
            } catch (reconnectError: any) {
              this.logger.error(`❌ Reconnect failed: ${reconnectError?.message}`);
              this.isReady = false;
            }
          } else {
            this.isReady = false;
          }
        }
      }, 15000); // 15 секунд вместо 30
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





















