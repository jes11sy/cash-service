import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload, RequestUser } from './interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    // Критическая проверка: JWT_SECRET обязателен!
    const jwtSecret = process.env.JWT_SECRET;
    
    if (!jwtSecret || jwtSecret.length < 32) {
      throw new Error(
        '❌ CRITICAL: JWT_SECRET must be defined and at least 32 characters long'
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: JwtPayload): Promise<RequestUser> {
    // Валидация payload
    if (!payload.sub || !payload.role) {
      throw new UnauthorizedException('Invalid token payload');
    }

    // 🔍 DEBUG: Логируем payload для отладки
    console.log('🔍 [JwtStrategy] Validating payload:', {
      userId: payload.sub,
      role: payload.role,
      roleType: typeof payload.role,
      cities: payload.cities,
    });

    return {
      userId: payload.sub,
      login: payload.login,
      role: payload.role as any, // Приводим к any, т.к. из JWT всегда приходит строка
      name: payload.name,
      cities: payload.cities || [],
    };
  }
}





















