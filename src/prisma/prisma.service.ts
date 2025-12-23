import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private keepAliveInterval: NodeJS.Timeout | null = null;

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
      
      // ✅ FIX: Keepalive ping каждые 60 секунд
      this.keepAliveInterval = setInterval(async () => {
        try {
          await this.$queryRaw`SELECT 1`;
        } catch (error: any) {
          this.logger.warn(`⚠️ Keepalive ping failed: ${error?.message}`);
        }
      }, 60000);
    } catch (error) {
      this.logger.error('❌ Failed to connect to database', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
    }
    await this.$disconnect();
    this.logger.log('✅ Database disconnected');
  }
}





















