import { useState } from 'react';
import type { User } from '../types/lms';
import { initialUsers } from '../data/seed';

export function useUsers() {
  const [users, setUsers] = useState<User[]>(initialUsers);

  function getUserById(id: number): User | undefined {
    return users.find(u => u.id === id);
  }

  function addUser(userData: Partial<User>): void {
    const newUser: User = {
      id: Math.max(...users.map(u => u.id)) + 1,
      name: userData.name || '',
      email: userData.email || '',
      roles: userData.roles || []
    };
    setUsers([...users, newUser]);
  }

  function updateUser(id: number, updates: Partial<User>): void {
    setUsers(users.map(user =>
      user.id === id ? { ...user, ...updates } : user
    ));
  }

  return { users, setUsers, getUserById, addUser, updateUser };
}
