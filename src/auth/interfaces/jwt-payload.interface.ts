import { UserRole } from '../roles.guard';

/**
 * JWT Payload structure
 */
export interface JwtPayload {
  sub: number; // User ID
  login: string;
  role: UserRole;
  name: string;
  cities: string[];
  iat?: number; // Issued at
  exp?: number; // Expiration time
}

/**
 * Request user object after JWT validation
 */
export interface RequestUser {
  userId: number;
  login: string;
  role: UserRole;
  name: string;
  cities: string[];
}

