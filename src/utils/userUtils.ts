import type { User, UserRole } from '../types/lms';

export function hasRole(user: User, role: UserRole | string): boolean {
  return user.roles.includes(role as UserRole);
}
