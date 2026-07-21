import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import type { Announcement, AnnouncementComment, AnnouncementAttachment, AnnouncementReaction, User, CourseStudent, Course } from '../types/lms';
import { uploadStreamGoogleDriveAttachment } from '../utils/googleDocsV2';

type ShowConfirmation = (
  title: string,
  message: string,
  confirmText: string,
  onConfirm: () => void
) => void;

type SupabaseProfileJoin = { id: string; name: string; avatar_url?: string | null } | null;

type SupabaseCommentRow = {
  id: number;
  announcement_id: number;
  content: string;
  created_at: string;
  author: SupabaseProfileJoin;
};

type SupabaseAttachmentRow = {
  id: number;
  announcement_id: number;
  uploader_id: string;
  attachment_type: AnnouncementAttachment['attachmentType'];
  file_name: string | null;
  storage_path: string | null;
  public_url: string | null;
  mime_type: string | null;
  file_size: number | null;
  link_url: string | null;
  link_title: string | null;
  created_at: string;
};

type SupabaseReactionRow = {
  id: number;
  announcement_id: number;
  user_id: string;
  emoji: string;
  created_at: string;
  user: SupabaseProfileJoin;
};

type SupabaseAnnouncementRow = {
  id: number;
  title: string;
  content: string;
  title_bg: string | null;
  content_bg: string | null;
  type: Announcement['type'];
  author_id: string | null;
  course_id: number | null;
  target_roles: string[] | null;
  status: Announcement['status'] | null;
  scheduled_at: string | null;
  published_at: string | null;
  is_pinned: boolean;
  is_staff_only: boolean;
  created_at: string;
  updated_at: string;
  author: SupabaseProfileJoin;
  comments: SupabaseCommentRow[] | null;
  attachments: SupabaseAttachmentRow[] | null;
  reactions: SupabaseReactionRow[] | null;
};

type AnnouncementUpdate = Partial<Announcement> & {
  notifyAudience?: boolean;
};

function mapAttachmentRow(row: SupabaseAttachmentRow): AnnouncementAttachment {
  return {
    id: row.id,
    announcementId: row.announcement_id,
    uploaderId: row.uploader_id,
    attachmentType: row.attachment_type,
    fileName: row.file_name,
    storagePath: row.storage_path,
    publicUrl: row.public_url,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    linkUrl: row.link_url,
    linkTitle: row.link_title,
    createdAt: row.created_at,
  };
}

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

function mapReactionRow(row: SupabaseReactionRow): AnnouncementReaction {
  return {
    id: row.id,
    announcementId: row.announcement_id,
    userId: row.user_id,
    userName: row.user?.name ?? null,
    emoji: row.emoji,
    createdAt: row.created_at,
  };
}

function mapAnnouncementRow(row: SupabaseAnnouncementRow): Announcement {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    titleBg: row.title_bg ?? null,
    contentBg: row.content_bg ?? null,
    type: row.type,
    authorId: row.author_id,
    authorName: row.author?.name ?? null,
    authorAvatarUrl: row.author?.avatar_url ?? null,
    courseId: row.course_id,
    targetRoles: row.target_roles,
    status: row.status ?? 'published',
    scheduledAt: row.scheduled_at,
    publishedAt: row.published_at,
    isPinned: row.is_pinned,
    isStaffOnly: row.is_staff_only,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    comments: (row.comments ?? []).map(mapCommentRow),
    attachments: (row.attachments ?? []).map(mapAttachmentRow),
    reactions: (row.reactions ?? []).map(mapReactionRow),
  };
}

function mapUpdatesToRow(updates: Partial<Announcement>) {
  const row: Record<string, unknown> = {};
  if (updates.title !== undefined) row.title = updates.title;
  if (updates.content !== undefined) row.content = updates.content;
  if (updates.titleBg !== undefined) row.title_bg = updates.titleBg;
  if (updates.contentBg !== undefined) row.content_bg = updates.contentBg;
  if (updates.type !== undefined) row.type = updates.type;
  if (updates.authorId !== undefined) row.author_id = updates.authorId;
  if (updates.courseId !== undefined) row.course_id = updates.courseId;
  if (updates.targetRoles !== undefined) row.target_roles = updates.targetRoles;
  if (updates.status !== undefined) row.status = updates.status;
  if (updates.scheduledAt !== undefined) row.scheduled_at = updates.scheduledAt;
  if (updates.publishedAt !== undefined) row.published_at = updates.publishedAt;
  if (updates.isPinned !== undefined) row.is_pinned = updates.isPinned;
  if (updates.isStaffOnly !== undefined) row.is_staff_only = updates.isStaffOnly;
  if (updates.createdAt !== undefined) row.created_at = updates.createdAt;
  if (updates.updatedAt !== undefined) row.updated_at = updates.updatedAt;
  return row;
}

async function syncAnnouncementNotificationJob({
  announcementId,
  authorId,
  status,
  scheduledAt,
  courseId,
  isPinned,
}: {
  announcementId: number;
  authorId: string;
  status: Announcement['status'];
  scheduledAt: string | null;
  courseId: number | null;
  isPinned: boolean;
}) {
  const cancelNotificationJob = async () => {
    await supabase
      .from('notification_jobs')
      .update({ status: 'canceled' })
      .eq('type', 'announcement_email')
      .eq('announcement_id', announcementId)
      .in('status', ['pending', 'failed']);
  };

  if (status === 'draft' || status === 'archived' || status === 'pending_review') {
    await cancelNotificationJob();
    return;
  }

  if (courseId !== null) {
    const { data: setting } = await supabase
      .from('stream_course_settings')
      .select('email_notifications')
      .eq('course_id', courseId)
      .maybeSingle();

    const emailMode = setting?.email_notifications ?? 'staff_and_pinned';
    const author = allAnnouncementAuthorsCache.get(authorId);
    let authorRoles = author;

    if (!authorRoles) {
      const { data: authorProfile } = await supabase
        .from('profiles')
        .select('roles')
        .eq('id', authorId)
        .maybeSingle();
      authorRoles = Array.isArray(authorProfile?.roles) ? authorProfile.roles : [];
      allAnnouncementAuthorsCache.set(authorId, authorRoles);
    }

    const isStaffAuthor = authorRoles.some(role =>
      ['administrator', 'teacher', 'mentor', 'team_leader'].includes(role)
    );
    const shouldNotify =
      emailMode === 'all_posts' ||
      (emailMode === 'staff_and_pinned' && (isStaffAuthor || isPinned)) ||
      (emailMode === 'pinned_only' && isPinned);

    if (!shouldNotify) {
      await cancelNotificationJob();
      return;
    }
  }

  await supabase.from('notification_jobs').upsert(
    {
      announcement_id: announcementId,
      type: 'announcement_email',
      status: 'pending',
      scheduled_for: status === 'scheduled' ? scheduledAt : new Date().toISOString(),
      created_by: authorId,
      payload: {
        announcementId,
      },
      error_message: null,
      attempts: 0,
      processed_at: null,
    },
    { onConflict: 'announcement_id,type' }
  );
}

const allAnnouncementAuthorsCache = new Map<string, string[]>();

const CUSTOM_USER_PREFIX = 'user:';

function getRealRoles(user: User) {
  return user.roles.filter(role => role !== 'dev');
}

function isStaffAudienceUser(user: User) {
  const realRoles = getRealRoles(user);
  return realRoles.some(role =>
    ['administrator', 'teacher', 'mentor', 'team_leader'].includes(role)
  );
}

function userTeachesCourse(userId: string, courseId: number, courses: Course[]) {
  return courses.some(course =>
    course.id === courseId &&
    course.subjects.some(subject =>
      subject.classes.some(cls => cls.teacherId === userId)
    )
  );
}

function userMentorsInCourse(userId: string, courseId: number, courseStudents: CourseStudent[]) {
  return courseStudents.some(enrollment =>
    enrollment.courseId === courseId &&
    enrollment.mentorId === userId &&
    enrollment.status === 'active'
  );
}

function getActiveCourseIdsByType(courseType: Course['courseType'], courses: Course[]) {
  return new Set(
    courses
      .filter(course => course.courseType === courseType && course.status === 'active')
      .map(course => course.id)
  );
}

function userMatchesAudienceTokens(
  user: User,
  tokens: string[],
  courseStudents: CourseStudent[],
  courses: Course[]
) {
  if (tokens.some(token => token === `${CUSTOM_USER_PREFIX}${user.id}`)) return true;
  if (tokens.includes('audience:staff') && isStaffAudienceUser(user)) return true;
  if (tokens.includes('role:teacher') && user.roles.includes('teacher')) return true;
  if (tokens.includes('role:translator') && user.roles.includes('translator')) return true;

  const activeCourseIds = new Set(
    courseStudents
      .filter(enrollment => enrollment.studentId === user.id && enrollment.status === 'active')
      .map(enrollment => enrollment.courseId)
  );

  const courseAudienceChecks: Array<{ token: string; courseType: Course['courseType'] }> = [
    { token: 'course:first_year', courseType: 'first_year' },
    { token: 'course:second_year', courseType: 'second_year' },
  ];

  for (const check of courseAudienceChecks) {
    if (!tokens.includes(check.token)) continue;
    const courseIds = getActiveCourseIdsByType(check.courseType, courses);
    if ([...courseIds].some(courseId => activeCourseIds.has(courseId))) return true;
    if ([...courseIds].some(courseId => userTeachesCourse(user.id, courseId, courses))) return true;
    if ([...courseIds].some(courseId => userMentorsInCourse(user.id, courseId, courseStudents))) return true;
  }

  return false;
}

function filterAnnouncementsForUser(
  announcements: Announcement[],
  filterUser: User,
  courseStudents: CourseStudent[],
  courses: Course[]
): Announcement[] {
  let filtered = announcements;
  const now = Date.now();
  const canManageAnnouncements =
    filterUser.roles.includes('administrator') || filterUser.roles.includes('teacher');

  filtered = filtered.filter(announcement => {
    const isAuthor = announcement.authorId === filterUser.id;
    if (announcement.status === 'draft') {
      return canManageAnnouncements && (isAuthor || filterUser.roles.includes('administrator'));
    }
    if (announcement.status === 'scheduled') {
      if (canManageAnnouncements && (isAuthor || filterUser.roles.includes('administrator'))) return true;
      return Boolean(announcement.scheduledAt && new Date(announcement.scheduledAt).getTime() <= now);
    }
    if (announcement.status === 'pending_review') {
      if (isAuthor || filterUser.roles.includes('administrator')) return true;
      return Boolean(
        announcement.courseId !== null &&
        filterUser.roles.includes('teacher') &&
        userTeachesCourse(filterUser.id, announcement.courseId, courses)
      );
    }
    if (announcement.status === 'archived') {
      return filterUser.roles.includes('administrator');
    }
    if (announcement.scheduledAt && new Date(announcement.scheduledAt).getTime() > now) {
      return canManageAnnouncements && (isAuthor || filterUser.roles.includes('administrator'));
    }
    return true;
  });

  if (!filterUser.roles.includes('administrator')) {
    filtered = filtered.filter(
      announcement => {
        const tokens = announcement.targetRoles ?? [];
        if (tokens.length > 0) {
          return userMatchesAudienceTokens(filterUser, tokens, courseStudents, courses);
        }

        return (
          announcement.courseId === null ||
          courseStudents.some(
            cs => cs.studentId === filterUser.id && cs.courseId === announcement.courseId
          ) ||
          (announcement.courseId !== null &&
            userTeachesCourse(filterUser.id, announcement.courseId, courses)) ||
          (announcement.courseId !== null &&
            userMentorsInCourse(filterUser.id, announcement.courseId, courseStudents))
        );
      }
    );
  }

  const isStudentOnly = filterUser.roles
    .filter(r => r !== 'dev')
    .every(r => r === 'student');

  if (isStudentOnly) {
    filtered = filtered.filter(a => !a.isStaffOnly);
  }

  return filtered;
}

export function useAnnouncements(
  fetchUser: User,
  filterUser: User,
  courseStudents: CourseStudent[],
  courses: Course[]
) {
  const [allAnnouncements, setAllAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetchAnnouncements = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('announcements')
        .select(`
          *,
          author:profiles!author_id (id, name, avatar_url),
          comments:announcement_comments (
            id, announcement_id, content, created_at,
            author:profiles!author_id (id, name)
          ),
          attachments:announcement_attachments (
            id, announcement_id, uploader_id, attachment_type,
            file_name, storage_path, public_url, mime_type,
            file_size, link_url, link_title, created_at
          )
        `)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const mapped = (data ?? []).map(row =>
        mapAnnouncementRow({ ...(row as object), reactions: [] } as unknown as SupabaseAnnouncementRow)
      );
      const announcementIds = mapped.map(announcement => announcement.id);

      if (announcementIds.length > 0) {
        const { data: reactionRows, error: reactionError } = await supabase
          .from('announcement_reactions')
          .select(`
            id, announcement_id, user_id, emoji, created_at,
            user:profiles!user_id (id, name)
          `)
          .in('announcement_id', announcementIds);

        if (reactionError) {
          console.warn('Announcement reactions are unavailable until the reaction migration is applied.', reactionError);
        } else {
          const reactionsByAnnouncement = new Map<number, AnnouncementReaction[]>();
          (reactionRows ?? []).forEach(row => {
            const reaction = mapReactionRow(row as unknown as SupabaseReactionRow);
            const existing = reactionsByAnnouncement.get(reaction.announcementId) ?? [];
            existing.push(reaction);
            reactionsByAnnouncement.set(reaction.announcementId, existing);
          });
          mapped.forEach(announcement => {
            announcement.reactions = reactionsByAnnouncement.get(announcement.id) ?? [];
          });
        }
      }

      setAllAnnouncements(mapped);
    } catch (err) {
      setError('Failed to load announcements');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [fetchUser.id]);

  useEffect(() => {
    refetchAnnouncements();
  }, [refetchAnnouncements]);

  const announcements = useMemo(
    () => filterAnnouncementsForUser(allAnnouncements, filterUser, courseStudents, courses),
    [allAnnouncements, filterUser, courseStudents, courses]
  );

  const addAnnouncement = useCallback(
    async (data: {
      title: string;
      content: string;
      titleBg?: string | null;
      contentBg?: string | null;
      type: Announcement['type'];
      courseId: number | null;
      targetRoles: string[] | null;
      isPinned: boolean;
      isStaffOnly?: boolean;
      status?: Announcement['status'];
      scheduledAt?: string | null;
      notifyAudience?: boolean;
    }): Promise<number> => {
      setError(null);
      try {
        const status = data.status ?? 'published';
        const scheduledAt = status === 'scheduled' ? data.scheduledAt ?? null : null;
        const publishedAt = status === 'published' ? new Date().toISOString() : null;
        const { data: inserted, error: insertError } = await supabase
          .from('announcements')
          .insert({
            title: data.title,
            content: data.content,
            title_bg: data.titleBg ?? null,
            content_bg: data.contentBg ?? null,
            type: data.type,
            author_id: fetchUser.id,
            course_id: data.courseId,
            target_roles: data.targetRoles,
            status,
            scheduled_at: scheduledAt,
            published_at: publishedAt,
            is_pinned: data.isPinned,
            is_staff_only: data.isStaffOnly ?? false,
          })
          .select('id')
          .single();

        if (insertError) throw insertError;

        await syncAnnouncementNotificationJob({
          announcementId: inserted.id,
          authorId: fetchUser.id,
          status,
          scheduledAt,
          courseId: data.courseId,
          isPinned: data.isPinned,
        });

        await refetchAnnouncements();

        return inserted.id;
      } catch (err) {
        setError('Failed to add announcement');
        console.error(err);
        throw err;
      }
    },
    [fetchUser.id, refetchAnnouncements]
  );

  const updateAnnouncement = useCallback(
    async (id: number, updates: AnnouncementUpdate) => {
      setError(null);
      try {
        const { notifyAudience = false, ...announcementUpdates } = updates;
        const previousAnnouncement = allAnnouncements.find(announcement => announcement.id === id);
        const now = new Date().toISOString();
        const updatesWithTimestamp: Partial<Announcement> = {
          ...announcementUpdates,
          updatedAt: now,
        };

        if (
          announcementUpdates.status === 'published' &&
          previousAnnouncement?.status !== 'published' &&
          announcementUpdates.publishedAt === undefined
        ) {
          updatesWithTimestamp.publishedAt = now;
        }

        const { error: updateError } = await supabase
          .from('announcements')
          .update(mapUpdatesToRow(updatesWithTimestamp))
          .eq('id', id);

        if (updateError) throw updateError;

        const updatedStatus = announcementUpdates.status;
        const effectiveStatus = updatedStatus ?? previousAnnouncement?.status;
        const shouldNotifyPublishedEdit =
          notifyAudience && previousAnnouncement?.status === 'published' && effectiveStatus === 'published';
        const shouldSyncNotificationJob =
          updatedStatus === 'scheduled' ||
          updatedStatus === 'draft' ||
          updatedStatus === 'archived' ||
          (updatedStatus === 'published' && previousAnnouncement?.status !== 'published') ||
          shouldNotifyPublishedEdit;

        if (effectiveStatus && shouldSyncNotificationJob) {
          const effectiveCourseId = announcementUpdates.courseId ?? previousAnnouncement?.courseId ?? null;
          const effectivePinned = announcementUpdates.isPinned ?? previousAnnouncement?.isPinned ?? false;
          await syncAnnouncementNotificationJob({
            announcementId: id,
            authorId: fetchUser.id,
            status: effectiveStatus,
            scheduledAt: announcementUpdates.scheduledAt ?? previousAnnouncement?.scheduledAt ?? null,
            courseId: effectiveCourseId,
            isPinned: effectivePinned,
          });
        }

        await refetchAnnouncements();
      } catch (err) {
        setError('Failed to update announcement');
        console.error(err);
      }
    },
    [allAnnouncements, fetchUser.id, refetchAnnouncements]
  );

  const deleteAnnouncement = useCallback(
    (id: number, showConfirmation: ShowConfirmation) => {
      const announcement = announcements.find(a => a.id === id);
      if (!announcement) return;

      showConfirmation(
        'Move to Trash',
        `Move "${announcement.title}" to trash? Admins can restore it or delete it permanently later.`,
        'Move to Trash',
        async () => {
          setError(null);
          try {
            const { error: updateError } = await supabase
              .from('announcements')
              .update({
                status: 'archived',
                is_pinned: false,
                updated_at: new Date().toISOString(),
              })
              .eq('id', id);

            if (updateError) throw updateError;

            await syncAnnouncementNotificationJob({
              announcementId: id,
              authorId: fetchUser.id,
              status: 'archived',
              scheduledAt: null,
              courseId: announcement.courseId,
              isPinned: false,
            });

            await refetchAnnouncements();
          } catch (err) {
            setError('Failed to move announcement to trash');
            console.error(err);
          }
        }
      );
    },
    [announcements, fetchUser.id, refetchAnnouncements]
  );

  const restoreAnnouncement = useCallback(
    async (id: number) => {
      setError(null);
      try {
        const { error: updateError } = await supabase
          .from('announcements')
          .update({
            status: 'published',
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);

        if (updateError) throw updateError;

        await refetchAnnouncements();
      } catch (err) {
        setError('Failed to restore announcement');
        console.error(err);
      }
    },
    [refetchAnnouncements]
  );

  const permanentlyDeleteAnnouncement = useCallback(
    (id: number, showConfirmation: ShowConfirmation) => {
      const announcement = announcements.find(a => a.id === id);
      if (!announcement) return;

      showConfirmation(
        'Delete Permanently',
        `Permanently delete "${announcement.title}"? This cannot be undone.`,
        'Delete Permanently',
        async () => {
          setError(null);
          try {
            const { error: deleteError } = await supabase
              .from('announcements')
              .delete()
              .eq('id', id)
              .eq('status', 'archived');

            if (deleteError) throw deleteError;

            await refetchAnnouncements();
          } catch (err) {
            setError('Failed to permanently delete announcement');
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
        const announcement = allAnnouncements.find(item => item.id === id);
        if (!announcement) return;
        const nextPinned = !currentPinned;

        if (nextPinned && announcement.courseId !== null) {
          const { data: setting } = await supabase
            .from('stream_course_settings')
            .select('pinned_post_limit')
            .eq('course_id', announcement.courseId)
            .maybeSingle();
          const pinnedLimit = Math.max(Number(setting?.pinned_post_limit ?? 3), 0);
          if (pinnedLimit <= 0) {
            setError('Pinned posts are disabled for this year group');
            return;
          }

          const pinnedInCourse = allAnnouncements
            .filter(item =>
              item.id !== id &&
              item.courseId === announcement.courseId &&
              item.isPinned &&
              item.status !== 'archived'
            )
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

          const pinsToRelease = Math.max(pinnedInCourse.length - pinnedLimit + 1, 0);
          if (pinsToRelease > 0) {
            const idsToRelease = pinnedInCourse.slice(0, pinsToRelease).map(item => item.id);
            const { error: unpinError } = await supabase
              .from('announcements')
              .update({ is_pinned: false, updated_at: new Date().toISOString() })
              .in('id', idsToRelease);
            if (unpinError) throw unpinError;
          }
        }

        const { error: updateError } = await supabase
          .from('announcements')
          .update({ is_pinned: nextPinned, updated_at: new Date().toISOString() })
          .eq('id', id);

        if (updateError) throw updateError;

        await syncAnnouncementNotificationJob({
          announcementId: id,
          authorId: announcement.authorId ?? fetchUser.id,
          status: announcement.status,
          scheduledAt: announcement.scheduledAt,
          courseId: announcement.courseId,
          isPinned: nextPinned,
        });

        await refetchAnnouncements();
      } catch (err) {
        setError('Failed to update pin status');
        console.error(err);
      }
    },
    [allAnnouncements, fetchUser.id, refetchAnnouncements]
  );

  const addComment = useCallback(
    async (announcementId: number, content: string) => {
      setError(null);
      try {
        const { error: insertError } = await supabase.from('announcement_comments').insert({
          announcement_id: announcementId,
          author_id: fetchUser.id,
          content,
        });

        if (insertError) throw insertError;

        await refetchAnnouncements();
      } catch (err) {
        setError('Failed to add comment');
        console.error(err);
      }
    },
    [fetchUser.id, refetchAnnouncements]
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

  const addAttachment = useCallback(
    async (
      announcementId: number,
      attachment: {
        file?: File;
        attachmentType: AnnouncementAttachment['attachmentType'];
        linkUrl?: string;
        linkTitle?: string;
      }
    ) => {
      setError(null);
      try {
        if (attachment.attachmentType === 'file') {
          if (!attachment.file) {
            throw new Error('File is required for file attachments');
          }

          await uploadStreamGoogleDriveAttachment({
            announcementId,
            file: attachment.file,
            displayName: attachment.linkTitle?.trim() || attachment.file.name,
          });
        } else {
          const { error: insertError } = await supabase
            .from('announcement_attachments')
            .insert({
              announcement_id: announcementId,
              uploader_id: fetchUser.id,
              attachment_type: attachment.attachmentType,
              link_url: attachment.linkUrl ?? null,
              link_title: attachment.linkTitle ?? null,
            });

          if (insertError) throw insertError;
        }

        await refetchAnnouncements();
      } catch (err) {
        setError('Failed to add attachment');
        console.error(err);
      }
    },
    [fetchUser.id, refetchAnnouncements]
  );

  const deleteAttachment = useCallback(
    async (attachmentId: number, storagePath: string | null) => {
      setError(null);
      try {
        if (storagePath && !/^[a-zA-Z0-9_-]{20,}$/.test(storagePath)) {
          const { error: storageError } = await supabase.storage
            .from('tbo-lms')
            .remove([storagePath]);
          if (storageError) throw storageError;
        }

        const { error: deleteError } = await supabase
          .from('announcement_attachments')
          .delete()
          .eq('id', attachmentId);

        if (deleteError) throw deleteError;

        await refetchAnnouncements();
      } catch (err) {
        setError('Failed to delete attachment');
        console.error(err);
      }
    },
    [refetchAnnouncements]
  );

  const toggleReaction = useCallback(
    async (announcementId: number, emoji: string) => {
      setError(null);
      try {
        const existing = allAnnouncements
          .find(announcement => announcement.id === announcementId)
          ?.reactions?.find(reaction => reaction.userId === fetchUser.id && reaction.emoji === emoji);

        if (existing) {
          const { error: deleteError } = await supabase
            .from('announcement_reactions')
            .delete()
            .eq('id', existing.id)
            .eq('user_id', fetchUser.id);

          if (deleteError) throw deleteError;
        } else {
          const { error: insertError } = await supabase
            .from('announcement_reactions')
            .insert({
              announcement_id: announcementId,
              user_id: fetchUser.id,
              emoji,
            });

          if (insertError) throw insertError;
        }

        await refetchAnnouncements();
      } catch (err) {
        setError('Failed to update reaction');
        console.error(err);
      }
    },
    [allAnnouncements, fetchUser.id, refetchAnnouncements]
  );

  return {
    announcements,
    loading,
    error,
    addAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    restoreAnnouncement,
    permanentlyDeleteAnnouncement,
    togglePin,
    addComment,
    deleteComment,
    addAttachment,
    deleteAttachment,
    toggleReaction,
    refetchAnnouncements,
  };
}
