import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Announcement, AnnouncementComment, User, CourseStudent } from '../types/lms';

type ShowConfirmation = (
  title: string,
  message: string,
  confirmText: string,
  onConfirm: () => void
) => void;

type SupabaseProfileJoin = { id: string; name: string } | null;

type SupabaseCommentRow = {
  id: number;
  announcement_id: number;
  content: string;
  created_at: string;
  author: SupabaseProfileJoin;
};

type SupabaseAnnouncementRow = {
  id: number;
  title: string;
  content: string;
  type: Announcement['type'];
  author_id: string | null;
  course_id: number | null;
  target_roles: string[] | null;
  is_pinned: boolean;
  is_staff_only: boolean;
  created_at: string;
  updated_at: string;
  author: SupabaseProfileJoin;
  comments: SupabaseCommentRow[] | null;
};

function mapCommentRow(row: SupabaseCommentRow): AnnouncementComment {
  return {
    id: row.id,
    announcementId: row.announcement_id,
    authorId: row.author?.id ?? '',
    authorName: row.author?.name ?? '',
    content: row.content,
    createdAt: row.created_at,
  };
}

function mapAnnouncementRow(row: SupabaseAnnouncementRow): Announcement {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    type: row.type,
    authorId: row.author_id,
    authorName: row.author?.name ?? null,
    courseId: row.course_id,
    targetRoles: row.target_roles,
    isPinned: row.is_pinned,
    isStaffOnly: row.is_staff_only,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    comments: (row.comments ?? []).map(mapCommentRow),
  };
}

function mapUpdatesToRow(updates: Partial<Announcement>) {
  const row: Record<string, unknown> = {};
  if (updates.title !== undefined) row.title = updates.title;
  if (updates.content !== undefined) row.content = updates.content;
  if (updates.type !== undefined) row.type = updates.type;
  if (updates.authorId !== undefined) row.author_id = updates.authorId;
  if (updates.courseId !== undefined) row.course_id = updates.courseId;
  if (updates.targetRoles !== undefined) row.target_roles = updates.targetRoles;
  if (updates.isPinned !== undefined) row.is_pinned = updates.isPinned;
  if (updates.isStaffOnly !== undefined) row.is_staff_only = updates.isStaffOnly;
  if (updates.createdAt !== undefined) row.created_at = updates.createdAt;
  if (updates.updatedAt !== undefined) row.updated_at = updates.updatedAt;
  return row;
}

function filterAnnouncementsForUser(
  announcements: Announcement[],
  currentUser: User,
  courseStudents: CourseStudent[]
): Announcement[] {
  let filtered = announcements;

  if (!currentUser.roles.includes('administrator')) {
    filtered = filtered.filter(
      announcement =>
        announcement.courseId === null ||
        courseStudents.some(
          cs => cs.studentId === currentUser.id && cs.courseId === announcement.courseId
        )
    );
  }

  const isStudentOnly = currentUser.roles
    .filter(r => r !== 'dev')
    .every(r => r === 'student');

  if (isStudentOnly) {
    filtered = filtered.filter(a => !a.isStaffOnly);
  }

  return filtered;
}

export function useAnnouncements(currentUser: User, courseStudents: CourseStudent[]) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetchAnnouncements = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('announcements')
        .select(`
          id, title, content, type, author_id, course_id, target_roles,
          is_pinned, is_staff_only, created_at, updated_at,
          author:profiles!author_id (id, name),
          comments:announcement_comments (
            id, announcement_id, content, created_at,
            author:profiles!author_id (id, name)
          )
        `)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const mapped = (data ?? []).map(row =>
        mapAnnouncementRow(row as unknown as SupabaseAnnouncementRow)
      );
      setAnnouncements(filterAnnouncementsForUser(mapped, currentUser, courseStudents));
    } catch (err) {
      setError('Failed to load announcements');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [currentUser, courseStudents]);

  useEffect(() => {
    refetchAnnouncements();
  }, [refetchAnnouncements]);

  const addAnnouncement = useCallback(
    async (data: {
      title: string;
      content: string;
      type: Announcement['type'];
      courseId: number | null;
      targetRoles: string[] | null;
      isPinned: boolean;
      isStaffOnly?: boolean;
    }) => {
      setError(null);
      try {
        const { error: insertError } = await supabase.from('announcements').insert({
          title: data.title,
          content: data.content,
          type: data.type,
          author_id: currentUser.id,
          course_id: data.courseId,
          target_roles: data.targetRoles,
          is_pinned: data.isPinned,
          is_staff_only: data.isStaffOnly ?? false,
        });

        if (insertError) throw insertError;

        await refetchAnnouncements();
      } catch (err) {
        setError('Failed to add announcement');
        console.error(err);
      }
    },
    [currentUser.id, refetchAnnouncements]
  );

  const updateAnnouncement = useCallback(
    async (id: number, updates: Partial<Announcement>) => {
      setError(null);
      try {
        const { error: updateError } = await supabase
          .from('announcements')
          .update(mapUpdatesToRow(updates))
          .eq('id', id);

        if (updateError) throw updateError;

        await refetchAnnouncements();
      } catch (err) {
        setError('Failed to update announcement');
        console.error(err);
      }
    },
    [refetchAnnouncements]
  );

  const deleteAnnouncement = useCallback(
    (id: number, showConfirmation: ShowConfirmation) => {
      const announcement = announcements.find(a => a.id === id);
      if (!announcement) return;

      showConfirmation(
        'Delete Announcement',
        `Are you sure you want to delete "${announcement.title}"? This action cannot be undone.`,
        'Delete Announcement',
        async () => {
          setError(null);
          try {
            const { error: deleteError } = await supabase
              .from('announcements')
              .delete()
              .eq('id', id);

            if (deleteError) throw deleteError;

            await refetchAnnouncements();
          } catch (err) {
            setError('Failed to delete announcement');
            console.error(err);
          }
        }
      );
    },
    [announcements, refetchAnnouncements]
  );

  const togglePin = useCallback(
    async (id: number, currentPinned: boolean) => {
      setError(null);
      try {
        const { error: updateError } = await supabase
          .from('announcements')
          .update({ is_pinned: !currentPinned })
          .eq('id', id);

        if (updateError) throw updateError;

        await refetchAnnouncements();
      } catch (err) {
        setError('Failed to update pin status');
        console.error(err);
      }
    },
    [refetchAnnouncements]
  );

  const addComment = useCallback(
    async (announcementId: number, content: string) => {
      setError(null);
      try {
        const { error: insertError } = await supabase.from('announcement_comments').insert({
          announcement_id: announcementId,
          author_id: currentUser.id,
          content,
        });

        if (insertError) throw insertError;

        await refetchAnnouncements();
      } catch (err) {
        setError('Failed to add comment');
        console.error(err);
      }
    },
    [currentUser.id, refetchAnnouncements]
  );

  const deleteComment = useCallback(
    async (commentId: number) => {
      setError(null);
      try {
        const { error: deleteError } = await supabase
          .from('announcement_comments')
          .delete()
          .eq('id', commentId);

        if (deleteError) throw deleteError;

        await refetchAnnouncements();
      } catch (err) {
        setError('Failed to delete comment');
        console.error(err);
      }
    },
    [refetchAnnouncements]
  );

  return {
    announcements,
    loading,
    error,
    addAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    togglePin,
    addComment,
    deleteComment,
    refetchAnnouncements,
  };
}
