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

    return {
      userId: payload.sub,
      login: payload.login,
      role: payload.role,
      name: payload.name,
      cities: payload.cities || [],
    };
  }
}





















