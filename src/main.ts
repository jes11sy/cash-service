import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap() {
  const isProduction = process.env.NODE_ENV === 'production';
  
  // ✅ FIX #86: Фильтрация уровней логов в production
  const logLevels: ('log' | 'error' | 'warn' | 'debug' | 'verbose')[] = isProduction
    ? ['log', 'error', 'warn']
    : ['log', 'error', 'warn', 'debug', 'verbose'];

  // 📝 Настройка логирования с фильтрацией чувствительных данных
  const fastifyLogger = {
    level: isProduction ? 'warn' : (process.env.LOG_LEVEL || 'info'), // ✅ FIX #86: warn в production
    serializers: {
      req(request) {
        return {
          method: request.method,
          url: request.url,
          hostname: request.hostname,
          remoteAddress: request.ip,
          // Фильтруем чувствительные заголовки
          headers: {
            ...request.headers,
            authorization: request.headers.authorization ? '[REDACTED]' : undefined,
            cookie: request.headers.cookie ? '[REDACTED]' : undefined,
          },
        };
      },
      res(reply) {
        return {
          statusCode: reply.statusCode,
        };
      },
    },
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.body.password',
        'req.body.token',
        '*.password',
        '*.token',
        '*.secret',
      ],
      remove: true,
    },
  };

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ 
      logger: fastifyLogger,
      trustProxy: true,
      requestIdHeader: 'x-request-id',
      requestIdLogLabel: 'reqId',
    }),
    {
      logger: logLevels, // ✅ FIX #86: Применяем фильтрацию логов NestJS
    },
  );

  const logger = new Logger('CashService');

  // 🍪 РЕГИСТРАЦИЯ COOKIE PLUGIN (до CORS!)
  await app.register(require('@fastify/cookie'), {
    secret: process.env.COOKIE_SECRET || process.env.JWT_SECRET,
  });
  logger.log('✅ Cookie plugin registered');

  // 🔒 CORS с безопасными настройками
  await app.register(require('@fastify/cors'), {
    origin: process.env.CORS_ORIGIN?.split(',') || ['https://yourdomain.com'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Origin',
      'X-Use-Cookies', // 🍪 Поддержка cookie mode
    ],
    maxAge: 86400, // 24 hours
  });

  // 🔒 SECURITY: Rate Limiting для защиты от DDoS и брутфорса
  await app.register(require('@fastify/rate-limit'), {
    max: 100, // Максимум 100 запросов
    timeWindow: '1 minute', // За 1 минуту
    errorResponseBuilder: () => ({
      success: false,
      statusCode: 429,
      message: 'Слишком много запросов. Пожалуйста, подождите.',
    }),
    keyGenerator: (request: any) => {
      // Используем userId из JWT если есть, иначе IP
      return request.user?.userId?.toString() || request.ip;
    },
  });
  logger.log('✅ Rate limiting configured (100 req/min)');

  // 🔒 Улучшенные Security Headers
  await app.register(require('@fastify/helmet'), {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"], // Для Swagger UI
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    dnsPrefetchControl: { allow: false },
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
    referrerPolicy: { policy: 'no-referrer' },
    xssFilter: true,
  });

  // 🔒 Валидация с подробными ошибками (без раскрытия чувствительной информации)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      disableErrorMessages: process.env.NODE_ENV === 'production' ? true : false,
      validationError: {
        target: false, // Не включаем объект в ошибку (может содержать чувствительные данные)
        value: false,  // Не включаем значение в ошибку
      },
    }),
  );
  
  // 🔥 NEW: Error logging filter (5xx errors → error_logs table)
  const prismaService = app.get(PrismaService);
  app.useGlobalFilters(new GlobalExceptionFilter(prismaService));

  const config = new DocumentBuilder()
    .setTitle('Cash Service API')
    .setDescription('Cash transactions and master handover microservice')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  app.setGlobalPrefix('api/v1');

  const port = process.env.PORT || 5006;
  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 Cash Service running on http://localhost:${port}`);
}

bootstrap();





















