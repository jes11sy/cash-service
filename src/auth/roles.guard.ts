import { Injectable, CanActivate, ExecutionContext, SetMetadata, ForbiddenException, UnauthorizedException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export enum UserRole {
  admin = 'admin',
  master = 'master',
  director = 'director',
  callcentre_admin = 'callcentre_admin',
  callcentre_operator = 'callcentre_operator',
  operator = 'operator',
}

export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // 🔍 DEBUG: Логируем роль пользователя для отладки
    this.logger.debug(`User role: "${user?.role}" (type: ${typeof user?.role}) | Required: [${requiredRoles.join(', ')}]`);

    if (!user || !user.role) {
      this.logger.warn('❌ Access DENIED: No user or role in request');
      throw new ForbiddenException('У вас нет доступа к этому ресурсу');
    }

    const hasRole = requiredRoles.some((role) => user?.role === role);
    
    if (!hasRole) {
      this.logger.warn(`❌ Access DENIED: User role "${user.role}" does not match required roles [${requiredRoles.join(', ')}]`);
      throw new ForbiddenException('У вас нет доступа к этому ресурсу');
    }

    return true;
  }
}














