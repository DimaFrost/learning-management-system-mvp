import { useState } from 'react';
import type { User } from '../types/lms';
import { initialUsers } from '../data/seed';

function nextUserId(users: User[]): string {
  const suffixes = users
    .map(u => u.id.match(/^user-(\d+)$/)?.[1])
    .filter((n): n is string => n != null)
    .map(Number);
  const max = suffixes.length > 0 ? Math.max(...suffixes) : 0;
  return `user-${max + 1}`;
}

export function useUsers() {
  const [users, setUsers] = useState<User[]>(initialUsers);

  function getUserById(id: string | null): User | undefined {
    if (id == null) return undefined;
    return users.find(u => u.id === id);
  }

  function addUser(userData: Partial<User>): void {
    const newUser: User = {
      id: nextUserId(users),
      name: userData.name || '',
      email: userData.email || '',
      roles: userData.roles || []
    };
    setUsers([...users, newUser]);
  }

  function updateUser(id: string, updates: Partial<User>): void {
    setUsers(users.map(user =>
      user.id === id ? { ...user, ...updates } : user
    ));
  }

  return { users, setUsers, getUserById, addUser, updateUser };
}
