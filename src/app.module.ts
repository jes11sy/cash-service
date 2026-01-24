import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CashModule } from './cash/cash.module';
import { HandoverModule } from './handover/handover.module';
import { AuditModule } from './audit/audit.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrometheusModule.register({
      defaultMetrics: { enabled: true },
      path: '/metrics',
    }),
    PrismaModule,
    AuthModule,
    CashModule,
    HandoverModule,
    AuditModule,
    HealthModule, // 🔧 FIX: Health checks для Kubernetes probes (предотвращает 502)
  ],
})
export class AppModule {}














