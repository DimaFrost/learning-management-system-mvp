import { useState, useEffect, useCallback } from 'react';
import { translate } from '../i18n/translate';
import { supabase } from '../lib/supabase';
import type { CourseType, User, UserRole } from '../types/lms';
import { queueProfileInviteEmail, queueRoleChangeEmail } from '../utils/notificationJobs';

type ShowConfirmation = (
  title: string,
  message: string,
  confirmText: string,
  onConfirm: () => void
) => void;

type ProfileUserRow = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  student_number?: string | null;
  roles: string[];
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
  preferred_language?: string | null;
  teaching_course_types?: string[] | null;
  is_online_student?: boolean | null;
  notification_preferences?: Partial<User['notificationPreferences']> | null;
};

type ProfileInvitePayload = {
  name?: string;
  firstName?: string;
  lastName?: string;
  roles?: UserRole[];
  preferredLanguage?: 'en' | 'bg';
  teachingCourseTypes?: CourseType[];
  isOnlineStudent?: boolean;
  phone?: string | null;
  studentNumber?: string | null;
  notificationPreferences?: Partial<User['notificationPreferences']>;
};

type AddUserInput = Partial<User> & {
  sendInviteEmail?: boolean;
};

function normalizeEmail(email: string | undefined | null) {
  return (email ?? '').trim().toLowerCase();
}

function getInvitePayload(user: Partial<User>): ProfileInvitePayload {
  return {
    name: user.name?.trim(),
    firstName: user.firstName?.trim(),
    lastName: user.lastName?.trim(),
    roles: user.roles ?? [],
    preferredLanguage: user.preferredLanguage === 'bg' ? 'bg' : 'en',
    teachingCourseTypes: user.teachingCourseTypes ?? [],
    isOnlineStudent: user.isOnlineStudent ?? false,
    phone: user.phone?.trim() || null,
    studentNumber: normalizeStudentNumber(user.studentNumber),
    notificationPreferences: user.notificationPreferences,
  };
}

function normalizeStudentNumber(value: string | null | undefined) {
  const normalized = (value ?? '').replace(/\s+/g, '').toUpperCase();
  return normalized || null;
}

function mapProfileToUser(row: ProfileUserRow): User {
  const teachingCourseTypes = (row.teaching_course_types ?? [])
    .filter((value): value is CourseType => value === 'first_year' || value === 'second_year');

  return {
    id: row.id,
    name: row.name,
    email: row.email ?? '',
    phone: row.phone ?? null,
    studentNumber: row.student_number ?? null,
    roles: row.roles as UserRole[],
    firstName: row.first_name ?? '',
    lastName: row.last_name ?? '',
    avatarUrl: row.avatar_url ?? null,
    preferredLanguage: row.preferred_language === 'bg' ? 'bg' : 'en',
    teachingCourseTypes,
    isOnlineStudent: row.is_online_student ?? false,
    notificationPreferences: {
      announcements: true,
      roleChange: true,
      enrollment: true,
      messages: true,
      ...row.notification_preferences,
    },
  };
}

const SAFE_PROFILE_COLUMNS = [
  'id',
  'name',
  'roles',
  'first_name',
  'last_name',
  'avatar_url',
  'preferred_language',
  'teaching_course_types',
  'is_online_student',
  'student_number',
].join(', ');

function canLoadContactDirectory(currentUser: User) {
  return currentUser.roles.includes('administrator');
}

export function useUsers(currentUser: User) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: profileRows, error: fetchError } = await supabase
        .from('profiles')
        .select(SAFE_PROFILE_COLUMNS)
        .order('name');

      if (fetchError) throw fetchError;

      let rows = (profileRows ?? []) as ProfileUserRow[];

      if (canLoadContactDirectory(currentUser)) {
        const { data: privateRows, error: privateError } = await supabase
          .from('profile_private_data')
          .select('profile_id, email, phone, notification_preferences');
        if (privateError) {
          console.error('Failed to load private profile directory fields', privateError);
        } else {
          const privateByProfileId = new Map(
            (privateRows ?? []).map(row => [row.profile_id, row])
          );

          rows = rows.map(row => ({
            ...row,
            email: privateByProfileId.get(row.id)?.email ?? null,
            phone: privateByProfileId.get(row.id)?.phone ?? null,
            notification_preferences: privateByProfileId.get(row.id)?.notification_preferences ?? null,
          }));
        }
      }

      setUsers(rows.map(mapProfileToUser));
    } catch (err) {
      setError(translate('errors.users.loadFailed'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    refetchUsers();
  }, [refetchUsers]);

  const getUserById = useCallback(
    (id: string | null) => (id == null ? undefined : users.find(u => u.id === id)),
    [users]
  );

  const addUser = useCallback(async (user: AddUserInput) => {
    if (!user.id) {
      const email = normalizeEmail(user.email);
      if (!email) {
        const message = translate('errors.users.inviteEmailRequired');
        setError(message);
        throw new Error(message);
      }

      const existingByEmail = users.find(existing => normalizeEmail(existing.email) === email);
      if (existingByEmail) {
        await updateUser(existingByEmail.id, user);
        return;
      }

      setError(null);
      try {
        const { error: inviteError } = await supabase
          .from('profile_invites')
          .insert({
            email,
            payload: getInvitePayload({ ...user, email }),
            created_by: currentUser.id,
          });

        if (inviteError) throw inviteError;

        if (user.sendInviteEmail !== false) {
          const queued = await queueProfileInviteEmail({
            createdBy: currentUser.id,
            email,
            name: user.name,
            roles: user.roles,
            actionUrl: window.location.origin,
          });
          if (!queued) {
            console.warn(`Profile invite was created, but invite email could not be queued for ${email}.`);
          }
        }

        await refetchUsers();
      } catch (err: any) {
        const message = err?.code === '23505'
          ? translate('errors.users.inviteAlreadyExists')
          : translate('errors.users.inviteFailed');
        setError(message);
        console.error(err);
        throw new Error(message);
      }
      return;
    }

    const existing = users.find(u => u.id === user.id);
    if (!existing) {
      setError(translate('errors.users.profileNotFound'));
      console.warn(`addUser: no profile found for id ${user.id}`);
      return;
    }

    setError(null);
    try {
      const rolesChanged = Boolean(
        user.roles &&
        (
          user.roles.length !== existing.roles.length ||
          user.roles.some(role => !existing.roles.includes(role))
        )
      );

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          name: user.name,
          roles: user.roles,
          ...(user.preferredLanguage !== undefined && { preferred_language: user.preferredLanguage }),
          ...(user.firstName !== undefined && { first_name: user.firstName }),
          ...(user.lastName !== undefined && { last_name: user.lastName }),
          ...(user.teachingCourseTypes !== undefined && { teaching_course_types: user.teachingCourseTypes }),
          ...(user.isOnlineStudent !== undefined && { is_online_student: user.isOnlineStudent }),
          ...(user.studentNumber !== undefined && { student_number: normalizeStudentNumber(user.studentNumber) }),
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      await refetchUsers();

      if (rolesChanged && user.roles) {
        const queued = await queueRoleChangeEmail({
          createdBy: currentUser.id,
          userId: existing.id,
          newRoles: user.roles,
        });
        if (!queued) {
          console.warn(`Profile roles were updated, but role-change email could not be queued for ${existing.id}.`);
        }
      }
    } catch (err) {
      setError(translate('errors.users.updateProfileFailed'));
      console.error(err);
    }
  }, [currentUser.id, users, refetchUsers]);

  const updateUser = useCallback(async (id: string, updates: Partial<User>) => {
    setError(null);
    const affected = users.find(u => u.id === id);
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          name: updates.name,
          roles: updates.roles,
          ...(updates.preferredLanguage !== undefined && { preferred_language: updates.preferredLanguage }),
          ...(updates.firstName !== undefined && { first_name: updates.firstName }),
          ...(updates.lastName !== undefined && { last_name: updates.lastName }),
          ...(updates.teachingCourseTypes !== undefined && { teaching_course_types: updates.teachingCourseTypes }),
          ...(updates.isOnlineStudent !== undefined && { is_online_student: updates.isOnlineStudent }),
          ...(updates.studentNumber !== undefined && { student_number: normalizeStudentNumber(updates.studentNumber) }),
        })
        .eq('id', id);

      if (updateError) throw updateError;

      if (updates.email !== undefined || updates.phone !== undefined) {
        const { error: privateError } = await supabase
          .from('profile_private_data')
          .upsert({
            profile_id: id,
            email: updates.email ?? affected?.email ?? '',
            phone: updates.phone ?? affected?.phone ?? null,
          }, { onConflict: 'profile_id' });
        if (privateError) throw privateError;
      }

      await refetchUsers();

      if (updates.roles && affected) {
        queueRoleChangeEmail({
          createdBy: currentUser.id,
          userId: affected.id,
          newRoles: updates.roles,
        }).catch(console.error);
      }
    } catch (err) {
      setError(translate('errors.users.updateFailed'));
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
          setError(translate('errors.users.deleteFailed'));
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
