import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Course, CourseStudent, StreamCourseSetting, StreamEmailNotificationMode, StreamPermission, User } from '../types/lms';

type StreamSettingRow = {
  course_id: number;
  permission: StreamPermission;
  require_student_post_approval: boolean | null;
  allow_student_attachments: boolean | null;
  email_notifications: StreamEmailNotificationMode | null;
  pinned_post_limit: number | null;
  updated_by: string | null;
  updated_at: string;
};

export const DEFAULT_STREAM_PERMISSION: StreamPermission = 'students_comment';
export const DEFAULT_STREAM_EMAIL_MODE: StreamEmailNotificationMode = 'staff_and_pinned';

function mapRow(row: StreamSettingRow): StreamCourseSetting {
  return {
    courseId: row.course_id,
    permission: row.permission,
    requireStudentPostApproval: row.require_student_post_approval ?? true,
    allowStudentAttachments: row.allow_student_attachments ?? false,
    emailNotifications: row.email_notifications ?? DEFAULT_STREAM_EMAIL_MODE,
    pinnedPostLimit: row.pinned_post_limit ?? 3,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
}

function defaultSetting(courseId: number): StreamCourseSetting {
  return {
    courseId,
    permission: DEFAULT_STREAM_PERMISSION,
    requireStudentPostApproval: true,
    allowStudentAttachments: false,
    emailNotifications: DEFAULT_STREAM_EMAIL_MODE,
    pinnedPostLimit: 3,
    updatedBy: null,
    updatedAt: '',
  };
}

export function useStreamSettings(currentUser: User, courses: Course[], courseStudents: CourseStudent[]) {
  const [settings, setSettings] = useState<StreamCourseSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('stream_course_settings')
        .select('course_id, permission, require_student_post_approval, allow_student_attachments, email_notifications, pinned_post_limit, updated_by, updated_at');
      if (fetchError) throw fetchError;
      setSettings((data ?? []).map(row => mapRow(row as StreamSettingRow)));
    } catch (err) {
      console.error('Failed to load stream settings', err);
      setError('Failed to load stream settings');
      setSettings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const getPermission = useCallback(
    (courseId: number | null | undefined): StreamPermission => {
      if (courseId == null) return 'staff_only';
      return settings.find(setting => setting.courseId === courseId)?.permission ?? DEFAULT_STREAM_PERMISSION;
    },
    [settings]
  );

  const getSetting = useCallback(
    (courseId: number): StreamCourseSetting => settings.find(setting => setting.courseId === courseId) ?? defaultSetting(courseId),
    [settings]
  );

  const updateSetting = useCallback(async (
    courseId: number,
    updates: Partial<Pick<
      StreamCourseSetting,
      'permission' | 'requireStudentPostApproval' | 'allowStudentAttachments' | 'emailNotifications' | 'pinnedPostLimit'
    >>
  ) => {
    const current = getSetting(courseId);
    const { error: upsertError } = await supabase
      .from('stream_course_settings')
      .upsert({
        course_id: courseId,
        permission: updates.permission ?? current.permission,
        require_student_post_approval: updates.requireStudentPostApproval ?? current.requireStudentPostApproval,
        allow_student_attachments: updates.allowStudentAttachments ?? current.allowStudentAttachments,
        email_notifications: updates.emailNotifications ?? current.emailNotifications,
        pinned_post_limit: updates.pinnedPostLimit ?? current.pinnedPostLimit,
        updated_by: currentUser.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'course_id' });
    if (upsertError) throw upsertError;
    await refetch();
  }, [currentUser.id, getSetting, refetch]);

  const updatePermission = useCallback(
    (courseId: number, permission: StreamPermission) => updateSetting(courseId, { permission }),
    [updateSetting]
  );

  const myActiveCourseIds = useMemo(
    () => courseStudents
      .filter(enrollment => enrollment.studentId === currentUser.id && enrollment.status === 'active')
      .map(enrollment => enrollment.courseId),
    [courseStudents, currentUser.id]
  );

  const canPostToCourse = useCallback(
    (courseId: number | null | undefined) => {
      if (currentUser.roles.includes('administrator')) return true;
      if (courseId == null) return currentUser.roles.includes('teacher');
      const teachesCourse = courses.some(course =>
        course.id === courseId &&
        course.subjects.some(subject => subject.classes.some(cls => cls.teacherId === currentUser.id))
      );
      if (teachesCourse) return true;
      if (!currentUser.roles.includes('student') || !myActiveCourseIds.includes(courseId)) return false;
      return getPermission(courseId) === 'students_post_comment';
    },
    [courses, currentUser.id, currentUser.roles, getPermission, myActiveCourseIds]
  );

  const canCommentOnCourse = useCallback(
    (courseId: number | null | undefined) => {
      if (currentUser.roles.includes('administrator')) return true;
      if (courseId == null) return currentUser.roles.includes('teacher');
      const teachesCourse = courses.some(course =>
        course.id === courseId &&
        course.subjects.some(subject => subject.classes.some(cls => cls.teacherId === currentUser.id))
      );
      if (teachesCourse) return true;
      if (!currentUser.roles.includes('student') || !myActiveCourseIds.includes(courseId)) return false;
      return getPermission(courseId) !== 'staff_only';
    },
    [courses, currentUser.id, currentUser.roles, getPermission, myActiveCourseIds]
  );

  return {
    settings,
    loading,
    error,
    getPermission,
    getSetting,
    updateSetting,
    updatePermission,
    canPostToCourse,
    canCommentOnCourse,
    refetch,
  };
}
