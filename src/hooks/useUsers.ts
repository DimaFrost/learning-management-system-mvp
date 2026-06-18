import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { User, UserRole } from '../types/lms';
import { sendNotification } from '../utils/notifications';

type ShowConfirmation = (
  title: string,
  message: string,
  confirmText: string,
  onConfirm: () => void
) => void;

function mapProfileToUser(row: {
  id: string;
  name: string;
  email: string;
  roles: string[];
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
  notification_preferences?: Partial<User['notificationPreferences']> | null;
}): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    roles: row.roles as UserRole[],
    firstName: row.first_name ?? '',
    lastName: row.last_name ?? '',
    avatarUrl: row.avatar_url ?? null,
    notificationPreferences: {
      announcements: true,
      roleChange: true,
      enrollment: true,
      messages: true,
      ...row.notification_preferences,
    },
  };
}

export function useUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .order('name');

      if (fetchError) throw fetchError;

      setUsers((data ?? []).map(mapProfileToUser));
    } catch (err) {
      setError('Failed to load users');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetchUsers();
  }, [refetchUsers]);

  const getUserById = useCallback(
    (id: string | null) => (id == null ? undefined : users.find(u => u.id === id)),
    [users]
  );

  const addUser = useCallback(async (user: Partial<User>) => {
    if (!user.id) {
      setError('User must sign up via Google before roles can be assigned.');
      console.warn('addUser: no profile id — user must sign up via Google auth first.');
      return;
    }

    const existing = users.find(u => u.id === user.id);
    if (!existing) {
      setError('Profile not found. The user must sign up via Google first.');
      console.warn(`addUser: no profile found for id ${user.id}`);
      return;
    }

    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          name: user.name,
          roles: user.roles,
          ...(user.firstName !== undefined && { first_name: user.firstName }),
          ...(user.lastName !== undefined && { last_name: user.lastName }),
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      await refetchUsers();
    } catch (err) {
      setError('Failed to update user profile');
      console.error(err);
    }
  }, [users, refetchUsers]);

  const updateUser = useCallback(async (id: string, updates: Partial<User>) => {
    setError(null);
    const affected = users.find(u => u.id === id);
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          name: updates.name,
          email: updates.email,
          roles: updates.roles,
          ...(updates.firstName !== undefined && { first_name: updates.firstName }),
          ...(updates.lastName !== undefined && { last_name: updates.lastName }),
        })
        .eq('id', id);

      if (updateError) throw updateError;
      await refetchUsers();

      if (updates.roles && affected) {
        sendNotification('role_change', {
          userId: affected.id,
          email: affected.email,
          name: affected.name,
          newRoles: updates.roles,
        }).catch(console.error);
      }
    } catch (err) {
      setError('Failed to update user');
      console.error(err);
    }
  }, [users, refetchUsers]);

  const deleteUser = useCallback((
    id: string,
    showConfirmation: ShowConfirmation,
    onUserDeleted: (id: string) => void
  ) => {
    const user = users.find(u => u.id === id);
    if (!user) return;

    showConfirmation(
      'Delete User',
      `Are you sure you want to delete user "${user.name}"? This will also remove them from all courses and delete all their mentorship logs. This action cannot be undone.`,
      'Delete User',
      async () => {
        setError(null);
        try {
          const { error: deleteError } = await supabase
            .from('profiles')
            .delete()
            .eq('id', id);

          if (deleteError) throw deleteError;

          await refetchUsers();
          onUserDeleted(id);
        } catch (err) {
          setError('Failed to delete user');
          console.error(err);
        }
      }
    );
  }, [users, refetchUsers]);

  return {
    users,
    loading,
    error,
    addUser,
    updateUser,
    deleteUser,
    refetchUsers,
    getUserById,
  };
}
