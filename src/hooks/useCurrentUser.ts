import { useState } from 'react';
import type { User } from '../types/lms';
import { initialCurrentUser } from '../data/seed';

export function useCurrentUser() {
  const [currentUser, setCurrentUser] = useState<User>(initialCurrentUser);
  const [showRoleSelector, setShowRoleSelector] = useState(false);

  function hasRole(role: string): boolean {
    return currentUser.roles.includes(role);
  }

  return { currentUser, setCurrentUser, showRoleSelector, setShowRoleSelector, hasRole };
}
