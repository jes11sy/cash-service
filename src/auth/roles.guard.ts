import { Injectable, CanActivate, ExecutionContext, SetMetadata } from '@nestjs/common';
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
    console.log('🔍 [RolesGuard] User role:', user?.role, '| Required roles:', requiredRoles);

    const hasRole = requiredRoles.some((role) => user?.role === role);
    
    if (!hasRole) {
      console.log('❌ [RolesGuard] Access DENIED: User role does not match required roles');
    }

    return hasRole;
  }
}














