import { useEffect, useState } from 'react';
import {
  Megaphone,
  Pin,
  Pencil,
  Trash,
  Plus,
  CalendarClock,
  Lock,
  FileText,
  Table,
  Presentation,
  Image,
  Link,
  X,
  BookOpen,
  MessageCircle,
  Paperclip,
  Send,
  RotateCcw,
  Settings,
  CheckCircle2,
  Upload,
} from 'lucide-react';
import type { Announcement, AnnouncementAttachment, User, Course, CourseStudent } from '../../types/lms';
import { hasRole } from '../../utils/userUtils';
import { getCourseDisplayName } from '../../utils/courseUtils';
import { CreateAnnouncementModal } from '../../components/modals/CreateAnnouncementModal';
import { PageHeader } from '../../components/ui/PageHeader';
import { useLanguage, type AppLanguage } from '../../i18n/LanguageContext';
import { formatPlatformDate } from '../../utils/dateUtils';
import { formatFileSize } from '../../utils/formatFileSize';
import { canPreviewInApp, resolveAnnouncementPreview } from '../../utils/filePreview';
import { FilePreviewModal } from '../../components/modals/FilePreviewModal';
import type { FilePreviewItem } from '../../utils/filePreview';
import type { useStreamSettings } from '../../hooks/useStreamSettings';

interface AnnouncementsViewProps {
  announcements: Announcement[];
  courses: Course[];
  users: User[];
  courseStudents: CourseStudent[];
  currentUser: User;
  loading: boolean;
  onAdd: (data: {
    title: string;
    content: string;
    titleBg?: string | null;
    contentBg?: string | null;
    type: Announcement['type'];
    courseId: number | null;
    targetRoles: string[] | null;
    isPinned: boolean;
    isStaffOnly: boolean;
    status: Announcement['status'];
    scheduledAt: string | null;
    notifyAudience?: boolean;
  }) => Promise<number>;
  onUpdate: (id: number, updates: Partial<Announcement> & { notifyAudience?: boolean }) => Promise<void>;
  onDelete: (id: number) => void;
  onRestore: (id: number) => Promise<void>;
  onPermanentDelete: (id: number) => void;
  onTogglePin: (id: number, current: boolean) => Promise<void>;
  onAddComment: (announcementId: number, content: string) => Promise<void>;
  onDeleteComment: (commentId: number) => void;
  onAddAttachment: (
    announcementId: number,
    attachment: {
      file?: File;
      attachmentType: AnnouncementAttachment['attachmentType'];
      linkUrl?: string;
      linkTitle?: string;
    }
  ) => Promise<void>;
  onDeleteAttachment: (id: number, storagePath: string | null) => Promise<void>;
  onToggleReaction: (announcementId: number, emoji: string) => Promise<void>;
  streamSettings: ReturnType<typeof useStreamSettings>;
  openCreateOnMount?: boolean;
  onCreateFlowClosed?: () => void;
}

type FilterValue = 'all' | Announcement['type'] | 'draft' | 'scheduled' | 'pending_review' | 'trash';

const FILTER_OPTIONS: { value: FilterValue; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'post', label: 'Posts' },
  { value: 'homework', label: 'Homework' },
  { value: 'material', label: 'Materials' },
  { value: 'system', label: 'System' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'pending_review', label: 'Pending review' },
  { value: 'draft', label: 'Drafts' },
  { value: 'trash', label: 'Trash' },
];

const REACTION_OPTIONS = ['👍', '❤️', '🙏', '🔥', '🎉'];

const TYPE_BADGE: Record<
  Announcement['type'],
  { label: string }
> = {
  post: { label: 'Post' },
  homework: { label: 'Homework' },
  material: { label: 'Material' },
  system: { label: 'System' },
};

const TYPE_BADGE_CLASS: Record<Announcement['type'], string> = {
  post: 'bg-[#dbeaff] text-[#171717]',
  homework: 'bg-[#fff7ed] text-[#9a3412]',
  material: 'bg-[#f5f5f5] text-[#171717]',
  system: 'bg-[#f5f5f5] text-[#525252]',
};

function AnnouncementTypeIcon({ type }: { type: Announcement['type'] }) {
  if (type === 'homework') return <BookOpen className="h-3.5 w-3.5" />;
  if (type === 'material') return <FileText className="h-3.5 w-3.5" />;
  if (type === 'system') return <Lock className="h-3.5 w-3.5" />;
  return <Megaphone className="h-3.5 w-3.5" />;
}

function formatRelativeTime(dateString: string): string {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  if (minutes < 1) return 'Now';
  if (minutes === 1) return '1 minute ago';
  if (minutes < 60) return `${minutes} minutes ago`;
  if (hours === 1) return '1 hour ago';
  if (hours < 24) return `${hours} hours ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return formatPlatformDate(dateString);
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts.slice(0, 2).map(part => part[0]?.toUpperCase()).join('');
}

function getAnnouncementStatusLabel(announcement: Announcement): string | null {
  if (announcement.status === 'draft') return 'Draft';
  if (announcement.status === 'scheduled') return 'Scheduled';
  if (announcement.status === 'pending_review') return 'Pending review';
  if (announcement.status === 'archived') return 'Trash';
  return null;
}

function getLocalizedAnnouncement(announcement: Announcement, language: AppLanguage) {
  const englishTitle = announcement.title?.trim() ?? '';
  const englishContent = announcement.content?.trim() ?? '';
  const bgTitle = announcement.titleBg?.trim() ?? '';
  const bgContent = announcement.contentBg?.trim() ?? '';

  if (language === 'bg' && bgTitle && bgContent) {
    return { title: bgTitle, content: bgContent, fallbackLanguage: null };
  }

  if (englishTitle && englishContent) {
    return {
      title: englishTitle,
      content: englishContent,
      fallbackLanguage: language === 'bg' ? 'English' : null,
    };
  }

  return {
    title: bgTitle || englishTitle || 'Untitled post',
    content: bgContent || englishContent || '',
    fallbackLanguage: language === 'en' && bgTitle && bgContent ? 'Bulgarian' : null,
  };
}

function isAnnouncementEdited(announcement: Announcement): boolean {
  const updatedAt = new Date(announcement.updatedAt).getTime();
  const baseline = new Date(announcement.publishedAt ?? announcement.createdAt).getTime();
  if (Number.isNaN(updatedAt) || Number.isNaN(baseline)) return false;
  return updatedAt - baseline > 60_000;
}

function getAudienceBadgeLabel(announcement: Announcement): string | null {
  const tokens = announcement.targetRoles ?? [];
  if (tokens.some(token => token.startsWith('user:'))) return 'Custom';
  if (tokens.includes('audience:staff')) return 'Staff';
  if (tokens.includes('role:teacher')) return 'Teachers';
  if (tokens.includes('course:first_year')) return 'First Year Students';
  if (tokens.includes('course:second_year')) return 'Second Year Students';
  if (announcement.isStaffOnly) return 'Staff only';
  return null;
}

function getAttachmentOpenUrl(attachment: AnnouncementAttachment): string | null {
  if (attachment.attachmentType === 'file') {
    return attachment.publicUrl;
  }
  return attachment.linkUrl;
}

function getAttachmentLabel(attachment: AnnouncementAttachment): string {
  if (attachment.attachmentType === 'file') {
    return attachment.fileName ?? 'File';
  }
  if (attachment.attachmentType === 'google_doc') {
    return attachment.linkTitle ?? 'Google Doc';
  }
  if (attachment.attachmentType === 'google_sheet') {
    return attachment.linkTitle ?? 'Google Sheet';
  }
  if (attachment.attachmentType === 'link') {
    return attachment.linkTitle ?? attachment.linkUrl ?? 'Link';
  }
  return attachment.linkTitle ?? 'Google Slides';
}

function getAttachmentTypeLabel(attachment: AnnouncementAttachment): string {
  if (attachment.attachmentType === 'file') {
    return attachment.mimeType?.startsWith('image/') ? 'Image' : 'File';
  }
  if (attachment.attachmentType === 'google_doc') return 'Google Doc';
  if (attachment.attachmentType === 'google_sheet') return 'Google Sheet';
  if (attachment.attachmentType === 'link') return 'Link';
  return 'Google Slides';
}

function AttachmentTypeIcon({ attachment }: { attachment: AnnouncementAttachment }) {
  if (attachment.attachmentType === 'file') {
    if (attachment.mimeType?.startsWith('image/')) {
      return <Image className="h-4 w-4 flex-shrink-0" />;
    }
    return <FileText className="h-4 w-4 flex-shrink-0" />;
  }
  if (attachment.attachmentType === 'google_doc') {
    return <FileText className="h-4 w-4 flex-shrink-0" />;
  }
  if (attachment.attachmentType === 'google_sheet') {
    return <Table className="h-4 w-4 flex-shrink-0" />;
  }
  if (attachment.attachmentType === 'link') {
    return <Link className="h-4 w-4 flex-shrink-0" />;
  }
  return <Presentation className="h-4 w-4 flex-shrink-0" />;
}

function getAttachmentIconTone(attachment: AnnouncementAttachment): string {
  if (attachment.attachmentType === 'google_doc') return 'bg-blue-50 text-[#2563eb] ring-blue-100';
  if (attachment.attachmentType === 'google_sheet') return 'bg-emerald-50 text-[#16a34a] ring-emerald-100';
  if (attachment.attachmentType === 'google_slide') return 'bg-orange-50 text-[#ea580c] ring-orange-100';
  if (attachment.attachmentType === 'link') return 'bg-violet-50 text-violet-700 ring-violet-100';
  if (attachment.mimeType?.startsWith('image/')) return 'bg-rose-50 text-rose-700 ring-rose-100';
  if (attachment.mimeType === 'application/pdf') return 'bg-red-50 text-red-700 ring-red-100';
  if (attachment.mimeType?.includes('word') || attachment.fileName?.match(/\.(doc|docx)$/i)) {
    return 'bg-blue-50 text-blue-700 ring-blue-100';
  }
  if (attachment.mimeType?.includes('spreadsheet') || attachment.fileName?.match(/\.(xls|xlsx|csv)$/i)) {
    return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
  }
  if (attachment.mimeType?.includes('presentation') || attachment.fileName?.match(/\.(ppt|pptx)$/i)) {
    return 'bg-orange-50 text-orange-700 ring-orange-100';
  }
  return 'bg-[#f5f5f5] text-[#525252] ring-[#e5e5e5]';
}

interface AnnouncementAttachmentsRowProps {
  attachments: AnnouncementAttachment[];
  currentUser: User;
  isAdmin: boolean;
  onDeleteAttachment: (id: number, storagePath: string | null) => Promise<void>;
  onPreviewAttachment: (item: FilePreviewItem) => void;
}

function AnnouncementAttachmentsRow({
  attachments,
  currentUser,
  isAdmin,
  onDeleteAttachment,
  onPreviewAttachment,
}: AnnouncementAttachmentsRowProps) {
  if (attachments.length === 0) return null;

  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {attachments.map(attachment => {
        const openUrl = getAttachmentOpenUrl(attachment);
        const preview = resolveAnnouncementPreview(attachment);
        const canPreview = canPreviewInApp(attachment);
        const canDelete = isAdmin || attachment.uploaderId === currentUser.id;
        const meta =
          attachment.attachmentType === 'file' && attachment.fileSize != null
            ? formatFileSize(attachment.fileSize)
            : getAttachmentTypeLabel(attachment);
        const chipContent = (
          <>
            <span className={`grid h-6 w-6 flex-shrink-0 place-items-center rounded-md ring-1 ${getAttachmentIconTone(attachment)}`}>
              <AttachmentTypeIcon attachment={attachment} />
            </span>
            <span className="min-w-0 truncate text-sm font-medium text-[#171717]">
              {getAttachmentLabel(attachment)}
            </span>
            <span className="hidden flex-shrink-0 text-xs text-[#a3a3a3] sm:inline">
              {meta}
            </span>
          </>
        );

        return (
          <span
            key={attachment.id}
            className="group inline-flex max-w-full items-center gap-2 rounded-full border border-[#e5e5e5] bg-white px-2 py-1.5 shadow-[0_1px_1px_rgba(0,0,0,0.03)] transition-colors hover:border-[#d4d4d4] hover:bg-[#fafafa] sm:max-w-[280px]"
          >
            {openUrl ? (
              canPreview && preview ? (
                <button
                  type="button"
                  onClick={() => onPreviewAttachment(preview)}
                  className="tbo-focus inline-flex min-w-0 items-center gap-2 text-left"
                  title={`Preview ${getAttachmentLabel(attachment)}`}
                >
                  {chipContent}
                </button>
              ) : (
                <a
                  href={openUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-w-0 items-center gap-2"
                  title={getAttachmentLabel(attachment)}
                >
                  {chipContent}
                </a>
              )
            ) : (
              <span className="inline-flex min-w-0 items-center gap-2" title={getAttachmentLabel(attachment)}>
                {chipContent}
              </span>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => onDeleteAttachment(attachment.id, attachment.storagePath)}
                className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full text-[#a3a3a3] opacity-100 hover:bg-[#fef2f2] hover:text-red-600 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100"
                aria-label="Remove attachment"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </span>
        );
      })}
    </div>
  );
}

interface AnnouncementCardProps {
  announcement: Announcement;
  courses: Course[];
  currentUser: User;
  isAdmin: boolean;
  isCommentsExpanded: boolean;
  commentDraft: string;
  onToggleComments: () => void;
  onCommentDraftChange: (value: string) => void;
  onTogglePin: (id: number, current: boolean) => Promise<void>;
  onEdit: (announcement: Announcement) => void;
  onDelete: (id: number) => void;
  onApprove: (id: number) => Promise<void>;
  onRestore: (id: number) => Promise<void>;
  onPermanentDelete: (id: number) => void;
  onToggleReaction: (announcementId: number, emoji: string) => Promise<void>;
  onAddComment: (announcementId: number, content: string) => Promise<void>;
  onDeleteComment: (commentId: number) => void;
  onDeleteAttachment: (id: number, storagePath: string | null) => Promise<void>;
  onPreviewAttachment: (item: FilePreviewItem) => void;
  canComment: boolean;
}

function AnnouncementCard({
  announcement,
  courses,
  currentUser,
  isAdmin,
  isCommentsExpanded,
  commentDraft,
  onToggleComments,
  onCommentDraftChange,
  onTogglePin,
  onEdit,
  onDelete,
  onApprove,
  onRestore,
  onPermanentDelete,
  onToggleReaction,
  onAddComment,
  onDeleteComment,
  onDeleteAttachment,
  onPreviewAttachment,
  canComment,
}: AnnouncementCardProps) {
  const { language, t } = useLanguage();
  const typeBadge = TYPE_BADGE[announcement.type];
  const localized = getLocalizedAnnouncement(announcement, language);
  const course =
    announcement.courseId !== null
      ? courses.find(c => c.id === announcement.courseId)
      : undefined;
  const comments = announcement.comments ?? [];
  const commentCount = comments.length;
  const canManage = isAdmin || announcement.authorId === currentUser.id;
  const authorName = announcement.authorName ?? 'Unknown';
  const authorAvatarUrl = announcement.authorAvatarUrl ?? (announcement.authorId === currentUser.id ? currentUser.avatarUrl : null);
  const attachments = announcement.attachments ?? [];
  const fileAttachmentCount = attachments.filter(attachment => attachment.attachmentType === 'file').length;
  const linkAttachmentCount = attachments.length - fileAttachmentCount;
  const statusLabel = getAnnouncementStatusLabel(announcement);
  const audienceBadgeLabel = getAudienceBadgeLabel(announcement);
  const edited = isAnnouncementEdited(announcement);
  const isArchived = announcement.status === 'archived';
  const isPendingReview = announcement.status === 'pending_review';
  const reactionCounts = (announcement.reactions ?? []).reduce<Record<string, number>>((acc, reaction) => {
    acc[reaction.emoji] = (acc[reaction.emoji] ?? 0) + 1;
    return acc;
  }, {});
  const userReactions = new Set(
    (announcement.reactions ?? [])
      .filter(reaction => reaction.userId === currentUser.id)
      .map(reaction => reaction.emoji)
  );

  const handlePostComment = async () => {
    const content = commentDraft.trim();
    if (!content) return;
    await onAddComment(announcement.id, content);
    onCommentDraftChange('');
  };

  return (
    <article className={`overflow-hidden rounded-2xl border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${
      announcement.isPinned ? 'border-[#fbbf24]/70 ring-1 ring-[#fef3c7]' : 'border-[#e5e5e5]'
    }`}>
      <div className="flex items-center justify-between gap-4 border-b border-[#f5f5f5] px-5 py-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${TYPE_BADGE_CLASS[announcement.type]}`}
          >
            <AnnouncementTypeIcon type={announcement.type} />
            {typeBadge.label}
          </span>
          {statusLabel && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#f5f5f5] px-2.5 py-1 text-xs font-medium text-[#525252] ring-1 ring-[#e5e5e5]">
              <CalendarClock className="h-3 w-3" />
              {statusLabel}
            </span>
          )}
          {audienceBadgeLabel && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#f5f5f5] px-2.5 py-1 text-xs font-medium text-[#525252]">
              <Lock className="w-3 h-3" />
              {audienceBadgeLabel}
            </span>
          )}
          {course && (
            <span className="inline-flex items-center rounded-full bg-[#f5f5f5] px-2.5 py-1 text-xs font-medium text-[#525252]">
              {getCourseDisplayName(course)}
            </span>
          )}
          {fileAttachmentCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-[#525252] ring-1 ring-[#e5e5e5]">
              <Paperclip className="h-3 w-3 text-[#737373]" />
              {fileAttachmentCount}
            </span>
          )}
          {linkAttachmentCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-[#525252] ring-1 ring-[#e5e5e5]">
              <Link className="h-3 w-3 text-[#737373]" />
              {linkAttachmentCount}
            </span>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <div className="flex h-9 items-center gap-2 rounded-full border border-[#e5e5e5] bg-white px-2 py-1">
            <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-[#f5f5f5] text-[11px] font-semibold text-[#525252] ring-1 ring-[#e5e5e5]">
              {authorAvatarUrl ? (
                <img src={authorAvatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                getInitials(authorName)
              )}
            </span>
            <span className="hidden min-w-0 items-center gap-1.5 text-xs sm:flex">
              <span className="max-w-[140px] truncate font-semibold text-[#171717]">{authorName}</span>
              <span className="h-1 w-1 rounded-full bg-[#d4d4d4]" />
              <span className="whitespace-nowrap text-[#737373]">{formatRelativeTime(announcement.createdAt)}</span>
              {edited && (
                <>
                  <span className="h-1 w-1 rounded-full bg-[#d4d4d4]" />
                  <span className="rounded-full bg-[#f5f5f5] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#737373]">
                    {t('announcements.edited')}
                  </span>
                </>
              )}
            </span>
          </div>
          {announcement.isPinned && !isArchived && (
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[#fff7ed] text-[#d97706]" title={t('announcements.pinned')}>
              <Pin className="h-4 w-4" aria-label={t('announcements.pinned')} />
            </span>
          )}
          {isAdmin && !isArchived && (
            <button
              type="button"
              onClick={() => onTogglePin(announcement.id, announcement.isPinned)}
              className="tbo-focus rounded-lg p-1.5 text-[#a3a3a3] hover:bg-[#fff7ed] hover:text-[#d97706]"
              aria-label={announcement.isPinned ? 'Unpin post' : 'Pin post'}
            >
              <Pin className="w-4 h-4" />
            </button>
          )}
          {isPendingReview && isAdmin && (
            <button
              type="button"
              onClick={() => onApprove(announcement.id)}
              className="tbo-focus inline-flex items-center gap-1.5 rounded-lg bg-[#ecfdf5] px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-[#d1fae5]"
              aria-label="Approve post"
            >
              <CheckCircle2 className="h-4 w-4" />
              Approve
            </button>
          )}
          {isArchived && isAdmin ? (
            <>
              <button
                type="button"
                onClick={() => onRestore(announcement.id)}
                className="tbo-focus rounded-lg p-1.5 text-[#a3a3a3] hover:bg-[#ecfdf5] hover:text-emerald-700"
                aria-label="Restore post"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onPermanentDelete(announcement.id)}
                className="tbo-focus rounded-lg p-1.5 text-[#a3a3a3] hover:bg-[#fef2f2] hover:text-red-600"
                aria-label="Permanently delete post"
              >
                <Trash className="h-4 w-4" />
              </button>
            </>
          ) : canManage && (
            <>
              <button
                type="button"
                onClick={() => onEdit(announcement)}
                className="tbo-focus rounded-lg p-1.5 text-[#a3a3a3] hover:bg-[#dbeaff] hover:text-[#2563eb]"
                aria-label="Edit post"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(announcement.id)}
                className="tbo-focus rounded-lg p-1.5 text-[#a3a3a3] hover:bg-[#fef2f2] hover:text-red-600"
                aria-label="Delete post"
              >
                <Trash className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="min-w-0 flex-1 text-xl font-semibold tracking-[-0.01em] text-[#171717]">{localized.title}</h3>
          {localized.fallbackLanguage && (
            <span className="rounded-full bg-[#f5f5f5] px-2 py-0.5 text-[11px] font-medium text-[#737373] ring-1 ring-[#e5e5e5]">
              {localized.fallbackLanguage}
            </span>
          )}
        </div>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#525252]">{localized.content}</p>

        {announcement.attachments && announcement.attachments.length > 0 && (
          <div className="mt-4">
            <AnnouncementAttachmentsRow
              attachments={announcement.attachments}
              currentUser={currentUser}
              isAdmin={isAdmin}
              onDeleteAttachment={onDeleteAttachment}
              onPreviewAttachment={onPreviewAttachment}
            />
          </div>
        )}

      </div>

      <div className="border-t border-[#f5f5f5] bg-[#fafafa] px-5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {REACTION_OPTIONS.map(emoji => {
              const count = reactionCounts[emoji] ?? 0;
              const selected = userReactions.has(emoji);
              const reactionUsers = (announcement.reactions ?? []).filter(reaction => reaction.emoji === emoji);
              const visibleReactionUsers = reactionUsers.slice(0, 6);
              const hiddenReactionUserCount = Math.max(reactionUsers.length - visibleReactionUsers.length, 0);
              return (
                <span key={emoji} className="group relative inline-flex">
                  <button
                    type="button"
                    disabled={isArchived}
                    onClick={() => onToggleReaction(announcement.id, emoji)}
                    className={`tbo-focus inline-flex h-8 items-center gap-1 rounded-full border px-2 text-sm transition ${
                      selected
                        ? 'border-[#2563eb] bg-[#dbeaff] text-[#171717]'
                        : count > 0
                          ? 'border-[#e5e5e5] bg-white text-[#525252] hover:border-[#d4d4d4] hover:bg-[#f5f5f5]'
                          : 'border-transparent bg-transparent text-[#a3a3a3] hover:bg-white hover:text-[#525252]'
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                    aria-label={`React ${emoji}`}
                  >
                    <span>{emoji}</span>
                    {count > 0 && <span className="text-xs font-semibold">{count}</span>}
                  </button>
                  {count > 0 && (
                    <span className="pointer-events-none absolute bottom-full left-0 z-30 mb-2 hidden w-64 rounded-2xl border border-[#e5e5e5] bg-white p-3 text-left shadow-[0_16px_40px_rgba(15,23,42,0.14)] group-hover:block group-focus-within:block">
                      <span className="mb-2 flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#737373]">{emoji} reactions</span>
                        <span className="rounded-full bg-[#f5f5f5] px-2 py-0.5 text-[11px] font-semibold text-[#525252]">
                          {count}
                        </span>
                      </span>
                      <span className="grid gap-2">
                        {visibleReactionUsers.map(reaction => (
                          <span key={`${reaction.userId}-${reaction.emoji}`} className="flex min-w-0 items-center gap-2">
                            <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full bg-[#f5f5f5] text-[10px] font-semibold text-[#525252] ring-1 ring-[#e5e5e5]">
                              {getInitials(reaction.userName)}
                            </span>
                            <span className="min-w-0 truncate text-sm font-medium text-[#171717]">{reaction.userName}</span>
                          </span>
                        ))}
                        {hiddenReactionUserCount > 0 && (
                          <span className="rounded-lg bg-[#fafafa] px-2 py-1 text-xs font-medium text-[#737373]">
                            +{hiddenReactionUserCount} more
                          </span>
                        )}
                      </span>
                    </span>
                  )}
                </span>
              );
            })}
          </div>
          <button
            type="button"
            onClick={onToggleComments}
            className="tbo-focus inline-flex items-center gap-2 rounded-lg text-sm font-medium text-[#525252] hover:text-[#171717]"
          >
            <MessageCircle className="h-4 w-4" />
            {commentCount} comment{commentCount !== 1 ? 's' : ''}
          </button>
        </div>

        {isCommentsExpanded && (
          <div className="mt-3 space-y-3">
            {comments.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#d4d4d4] bg-white px-3 py-3 text-sm text-[#737373]">No comments yet.</p>
            ) : (
              comments.map(comment => (
                <div key={comment.id} className="rounded-xl border border-[#e5e5e5] bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-[#171717]">{comment.authorName}</p>
                      <p className="mt-1 text-sm text-[#525252]">{comment.content}</p>
                      <p className="mt-1 text-xs text-[#a3a3a3]">
                        {formatRelativeTime(comment.createdAt)}
                      </p>
                    </div>
                    {comment.authorId === currentUser.id && (
                      <button
                        type="button"
                        onClick={() => onDeleteComment(comment.id)}
                        className="flex-shrink-0 rounded-md px-2 py-1 text-xs text-red-600 hover:bg-[#fef2f2] hover:text-red-800"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}

            {canComment ? (
              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={commentDraft}
                  onChange={e => onCommentDraftChange(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handlePostComment();
                    }
                  }}
                  placeholder="Add a comment"
                  className="tbo-focus flex-1 rounded-lg border border-[#d4d4d4] bg-white px-3 py-2 text-sm text-[#171717] placeholder:text-[#a3a3a3]"
                />
                <button
                  type="button"
                  onClick={handlePostComment}
                  disabled={!commentDraft.trim()}
                  className="tbo-focus inline-flex items-center gap-1.5 rounded-lg bg-[#171717] px-3 py-2 text-sm font-medium text-white hover:bg-[#404040] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Post</span>
                </button>
              </div>
            ) : (
              <p className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm text-[#737373]">
                Comments are closed for this Stream item.
              </p>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

export function AnnouncementsView({
  announcements,
  courses,
  users,
  courseStudents,
  currentUser,
  loading,
  onAdd,
  onUpdate,
  onDelete,
  onRestore,
  onPermanentDelete,
  onTogglePin,
  onAddComment,
  onDeleteComment,
  onAddAttachment,
  onDeleteAttachment,
  onToggleReaction,
  streamSettings,
  openCreateOnMount = false,
  onCreateFlowClosed,
}: AnnouncementsViewProps) {
  const { t } = useLanguage();
  const [filter, setFilter] = useState<FilterValue>('all');
  const [modalOpen, setModalOpen] = useState(openCreateOnMount);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [expandedComments, setExpandedComments] = useState<Set<number>>(new Set());
  const [commentDrafts, setCommentDrafts] = useState<Record<number, string>>({});
  const [previewItem, setPreviewItem] = useState<FilePreviewItem | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const isAdmin = hasRole(currentUser, 'administrator');
  const isTeacher = hasRole(currentUser, 'teacher');
  const isStudent = hasRole(currentUser, 'student');
  const canCreateAnnouncement =
    isAdmin || isTeacher;
  const studentPostCourses = courses.filter(course =>
    course.status === 'active' &&
    streamSettings.canPostToCourse(course.id) &&
    courseStudents.some(enrollment =>
      enrollment.courseId === course.id &&
      enrollment.studentId === currentUser.id &&
      enrollment.status === 'active'
    )
  );
  const [studentComposerCourseId, setStudentComposerCourseId] = useState<number | null>(
    studentPostCourses[0]?.id ?? null
  );
  const [studentComposerText, setStudentComposerText] = useState('');
  const [studentComposerFile, setStudentComposerFile] = useState<File | null>(null);
  const [studentComposerLinkUrl, setStudentComposerLinkUrl] = useState('');
  const [studentComposerLinkTitle, setStudentComposerLinkTitle] = useState('');
  const [studentComposerSaving, setStudentComposerSaving] = useState(false);
  const canUseStudentComposer = isStudent && !canCreateAnnouncement && studentPostCourses.length > 0;
  const selectedStudentComposerSetting =
    studentComposerCourseId == null ? null : streamSettings.getSetting(studentComposerCourseId);
  const canAttachToStudentPost = Boolean(selectedStudentComposerSetting?.allowStudentAttachments);

  useEffect(() => {
    if (!openCreateOnMount || !canCreateAnnouncement) return;
    setEditingAnnouncement(null);
    setModalOpen(true);
  }, [canCreateAnnouncement, openCreateOnMount]);

  const visibleFilterOptions = FILTER_OPTIONS.filter(option => {
    if (option.value === 'trash') return isAdmin;
    if (option.value === 'scheduled' || option.value === 'draft' || option.value === 'pending_review') return canCreateAnnouncement;
    return true;
  });

  useEffect(() => {
    if (studentComposerCourseId && studentPostCourses.some(course => course.id === studentComposerCourseId)) return;
    setStudentComposerCourseId(studentPostCourses[0]?.id ?? null);
  }, [studentComposerCourseId, studentPostCourses]);

  const submitStudentPost = async () => {
    const content = studentComposerText.trim();
    if (!content || studentComposerCourseId == null) return;
    const setting = streamSettings.getSetting(studentComposerCourseId);
    const fileToAttach = setting.allowStudentAttachments ? studentComposerFile : null;
    const linkUrl = setting.allowStudentAttachments ? studentComposerLinkUrl.trim() : '';
    const linkTitle = setting.allowStudentAttachments ? studentComposerLinkTitle.trim() : '';
    setStudentComposerSaving(true);
    try {
      const announcementId = await onAdd({
        title: content.length > 80 ? `${content.slice(0, 77)}...` : content,
        content,
        type: 'post',
        courseId: studentComposerCourseId,
        targetRoles: null,
        isPinned: false,
        isStaffOnly: false,
        status: setting.requireStudentPostApproval ? 'pending_review' : 'published',
        scheduledAt: null,
        notifyAudience: false,
      });
      if (fileToAttach) {
        await onAddAttachment(announcementId, {
          file: fileToAttach,
          attachmentType: 'file',
          linkTitle: fileToAttach.name,
        });
      }
      if (linkUrl) {
        await onAddAttachment(announcementId, {
          attachmentType: 'link',
          linkUrl,
          linkTitle: linkTitle || linkUrl,
        });
      }
      setStudentComposerText('');
      setStudentComposerFile(null);
      setStudentComposerLinkUrl('');
      setStudentComposerLinkTitle('');
    } finally {
      setStudentComposerSaving(false);
    }
  };

  const filteredList =
    filter === 'all'
      ? announcements.filter(a => a.status !== 'archived')
      : filter === 'trash'
        ? announcements.filter(a => a.status === 'archived')
      : filter === 'scheduled' || filter === 'draft' || filter === 'pending_review'
        ? announcements.filter(a => a.status === filter)
        : announcements.filter(a => a.type === filter && a.status !== 'archived');

  const pinnedList = filteredList.filter(a => a.isPinned);
  const regularList = filteredList.filter(a => !a.isPinned);

  const activeFilterLabel =
    FILTER_OPTIONS.find(option => option.value === filter)?.label.toLowerCase() ?? filter;

  const toggleComments = (id: number) => {
    setExpandedComments(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const openCreateModal = () => {
    setEditingAnnouncement(null);
    setModalOpen(true);
  };

  const openEditModal = (announcement: Announcement) => {
    setEditingAnnouncement(announcement);
    setModalOpen(true);
  };

  const approveAnnouncement = async (id: number) => {
    await onUpdate(id, {
      status: 'published',
      publishedAt: new Date().toISOString(),
    });
  };

  const liveEditingAnnouncement = editingAnnouncement
    ? announcements.find(a => a.id === editingAnnouncement.id) ?? editingAnnouncement
    : null;

  const closeModal = () => {
    setModalOpen(false);
    setEditingAnnouncement(null);
    if (openCreateOnMount) {
      onCreateFlowClosed?.();
    }
  };

  const renderCard = (announcement: Announcement) => (
    <AnnouncementCard
      key={announcement.id}
      announcement={announcement}
      courses={courses}
      currentUser={currentUser}
      isAdmin={isAdmin}
      isCommentsExpanded={expandedComments.has(announcement.id)}
      commentDraft={commentDrafts[announcement.id] ?? ''}
      onToggleComments={() => toggleComments(announcement.id)}
      onCommentDraftChange={value =>
        setCommentDrafts(prev => ({ ...prev, [announcement.id]: value }))
      }
      onTogglePin={onTogglePin}
      onEdit={openEditModal}
      onDelete={onDelete}
      onApprove={approveAnnouncement}
      onRestore={onRestore}
      onPermanentDelete={onPermanentDelete}
      onToggleReaction={onToggleReaction}
      onAddComment={onAddComment}
      onDeleteComment={onDeleteComment}
      onDeleteAttachment={onDeleteAttachment}
      onPreviewAttachment={setPreviewItem}
      canComment={streamSettings.canCommentOnCourse(announcement.courseId)}
    />
  );

  if (modalOpen) {
    return (
      <>
        <CreateAnnouncementModal
        isOpen={modalOpen}
        editingAnnouncement={editingAnnouncement}
        announcementId={liveEditingAnnouncement?.id ?? null}
        existingAttachments={liveEditingAnnouncement?.attachments ?? []}
        courses={courses}
        users={users}
        courseStudents={courseStudents}
        currentUser={currentUser}
        onClose={closeModal}
        onAddAttachment={onAddAttachment}
        onDeleteAttachment={onDeleteAttachment}
        onSubmit={async data => {
          if (editingAnnouncement) {
            await onUpdate(editingAnnouncement.id, { ...data });
            return editingAnnouncement.id;
          }
          return await onAdd(data);
        }}
        />
        <FilePreviewModal item={previewItem} onClose={() => setPreviewItem(null)} />
      </>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('announcements.title')}
        action={
          isAdmin || canCreateAnnouncement ? (
            <div className="flex w-full items-center gap-2 sm:w-auto">
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="tbo-focus grid h-10 w-10 place-items-center rounded-lg border border-[#e5e5e5] bg-white text-[#525252] hover:bg-[#f5f5f5] hover:text-[#171717]"
                  aria-label="Stream settings"
                  title="Stream settings"
                >
                  <Settings className="h-4 w-4" />
                </button>
              )}
              {canCreateAnnouncement && (
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="tbo-focus flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#171717] px-4 py-2 text-sm font-medium text-white hover:bg-[#404040] sm:w-auto"
                >
                  <Plus className="w-4 h-4" />
                  <span>{t('announcements.new')}</span>
                </button>
              )}
            </div>
          ) : undefined
        }
      />

      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#171717]/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <button type="button" className="absolute inset-0 cursor-default" onClick={() => setSettingsOpen(false)} aria-label="Close stream settings" />
          <section role="dialog" aria-modal="true" className="relative max-h-[90vh] w-full overflow-hidden rounded-t-2xl border border-[#e5e5e5] bg-white shadow-2xl sm:max-w-2xl sm:rounded-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-[#e5e5e5] px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#737373]">Stream settings</p>
                <h3 className="mt-1 text-xl font-semibold text-[#171717]">Student permissions</h3>
                <p className="mt-1 text-sm text-[#737373]">Decide what students can do in each active year group.</p>
              </div>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-lg border border-[#e5e5e5] text-[#737373] hover:bg-[#f5f5f5]"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="tbo-scrollbar max-h-[68vh] space-y-4 overflow-y-auto bg-[#fafafa] p-5">
              {courses.filter(course => course.status === 'active').map((course, index) => {
                const setting = streamSettings.getSetting(course.id);
                const tone = index % 2 === 0
                  ? {
                      shell: 'border-[#bfdbfe] bg-[#eff6ff]',
                      chip: 'bg-[#dbeaff] text-[#2563eb]',
                      accent: 'text-[#1d4ed8]',
                    }
                  : {
                      shell: 'border-[#fed7aa] bg-[#fff7ed]',
                      chip: 'bg-[#ffedd5] text-[#c2410c]',
                      accent: 'text-[#c2410c]',
                    };
                return (
                  <section key={course.id} className={`rounded-2xl border p-4 ${tone.shell}`}>
                    <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                      <div className="min-w-0">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${tone.chip}`}>
                          Year group
                        </span>
                        <h4 className="mt-2 truncate text-base font-semibold text-[#171717]">{getCourseDisplayName(course)}</h4>
                        <p className="mt-0.5 text-xs text-[#737373]">Default is comment only until changed.</p>
                      </div>
                      <label className="block">
                        <span className="mb-1 block text-xs font-semibold text-[#737373]">Student access</span>
                        <select
                          value={setting.permission}
                          onChange={event => streamSettings.updateSetting(course.id, { permission: event.target.value as any })}
                          className="h-10 w-full rounded-xl border border-white/70 bg-white px-3 text-sm font-semibold text-[#525252] shadow-sm sm:w-44"
                        >
                          <option value="students_post_comment">Post & comment</option>
                          <option value="students_comment">Comment only</option>
                          <option value="staff_only">Staff only</option>
                        </select>
                      </label>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <label className="flex items-start gap-3 rounded-xl border border-white/70 bg-white/85 p-3 shadow-sm">
                        <input
                          type="checkbox"
                          checked={setting.requireStudentPostApproval}
                          onChange={event => streamSettings.updateSetting(course.id, { requireStudentPostApproval: event.target.checked })}
                          className="mt-1 h-4 w-4 rounded border-[#d4d4d4]"
                        />
                        <span>
                          <span className="block text-sm font-semibold text-[#171717]">Approve student posts</span>
                          <span className="text-xs text-[#737373]">Student posts wait for review before appearing.</span>
                        </span>
                      </label>

                      <label className="flex items-start gap-3 rounded-xl border border-white/70 bg-white/85 p-3 shadow-sm">
                        <input
                          type="checkbox"
                          checked={setting.allowStudentAttachments}
                          onChange={event => streamSettings.updateSetting(course.id, { allowStudentAttachments: event.target.checked })}
                          className="mt-1 h-4 w-4 rounded border-[#d4d4d4]"
                        />
                        <span>
                          <span className="block text-sm font-semibold text-[#171717]">Student attachments</span>
                          <span className="text-xs text-[#737373]">Allow files/links on student Stream posts.</span>
                        </span>
                      </label>

                      <label className="block rounded-xl border border-white/70 bg-white/85 p-3 shadow-sm">
                        <span className="mb-1 block text-sm font-semibold text-[#171717]">Email notifications</span>
                        <select
                          value={setting.emailNotifications}
                          onChange={event => streamSettings.updateSetting(course.id, { emailNotifications: event.target.value as any })}
                          className="h-10 w-full rounded-lg border border-[#e5e5e5] bg-white px-3 text-sm text-[#525252]"
                        >
                          <option value="all_posts">All posts</option>
                          <option value="staff_and_pinned">Staff and pinned</option>
                          <option value="pinned_only">Pinned only</option>
                          <option value="none">None</option>
                        </select>
                      </label>

                      <label className="block rounded-xl border border-white/70 bg-white/85 p-3 shadow-sm">
                        <span className="mb-1 block text-sm font-semibold text-[#171717]">Pinned post limit</span>
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min="0"
                            max="10"
                            value={setting.pinnedPostLimit}
                            onChange={event => streamSettings.updateSetting(course.id, { pinnedPostLimit: Number(event.target.value) })}
                            className="min-w-0 flex-1 accent-[#171717]"
                          />
                          <span className={`grid h-9 w-9 place-items-center rounded-lg bg-white text-sm font-semibold ${tone.accent}`}>
                            {setting.pinnedPostLimit}
                          </span>
                        </div>
                      </label>
                    </div>
                  </section>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {canUseStudentComposer && (
        <div className="tbo-panel p-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold text-[#171717]">Share with your year group</p>
              {studentPostCourses.length > 1 && (
                <select
                  value={studentComposerCourseId ?? ''}
                  onChange={event => setStudentComposerCourseId(Number(event.target.value))}
                  className="h-9 rounded-lg border border-[#d4d4d4] bg-white px-3 text-sm"
                >
                  {studentPostCourses.map(course => (
                    <option key={course.id} value={course.id}>{getCourseDisplayName(course)}</option>
                  ))}
                </select>
              )}
            </div>
            <textarea
              value={studentComposerText}
              onChange={event => setStudentComposerText(event.target.value)}
              placeholder="Ask a question or share something with your class..."
              className="tbo-focus min-h-24 rounded-xl border border-[#d4d4d4] bg-white p-3 text-sm"
            />
            {selectedStudentComposerSetting?.requireStudentPostApproval && (
              <div className="rounded-xl border border-[#fde68a] bg-[#fffbeb] px-3 py-2 text-xs font-medium text-[#92400e]">
                Your post will be sent to an administrator for review before it appears in Stream.
              </div>
            )}
            {canAttachToStudentPost && (
              <div className="grid gap-2 rounded-xl border border-[#e5e5e5] bg-[#fafafa] p-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-[#525252]">
                    <Upload className="h-3.5 w-3.5" />
                    File
                  </span>
                  <input
                    type="file"
                    onChange={event => setStudentComposerFile(event.target.files?.[0] ?? null)}
                    className="block w-full text-xs text-[#525252] file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[#171717]"
                  />
                  {studentComposerFile && (
                    <span className="mt-1 block truncate text-xs text-[#737373]">{studentComposerFile.name}</span>
                  )}
                </label>
                <div className="grid gap-2">
                  <label className="block">
                    <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-[#525252]">
                      <Link className="h-3.5 w-3.5" />
                      Link
                    </span>
                    <input
                      value={studentComposerLinkUrl}
                      onChange={event => setStudentComposerLinkUrl(event.target.value)}
                      placeholder="https://..."
                      className="tbo-focus h-9 w-full rounded-lg border border-[#d4d4d4] bg-white px-3 text-sm"
                    />
                  </label>
                  <input
                    value={studentComposerLinkTitle}
                    onChange={event => setStudentComposerLinkTitle(event.target.value)}
                    placeholder="Optional link title"
                    className="tbo-focus h-9 w-full rounded-lg border border-[#d4d4d4] bg-white px-3 text-sm"
                  />
                </div>
              </div>
            )}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void submitStudentPost()}
                disabled={!studentComposerText.trim() || studentComposerSaving}
                className="tbo-focus rounded-xl bg-[#171717] px-4 py-2 text-sm font-semibold text-white hover:bg-[#404040] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {studentComposerSaving ? 'Posting...' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="tbo-panel flex flex-wrap gap-2 p-2">
        {visibleFilterOptions.map(option => (
          <button
            key={option.value}
            type="button"
            onClick={() => setFilter(option.value)}
            className={`tbo-focus rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === option.value
                ? 'bg-[#dbeaff] text-[#171717]'
                : 'text-[#525252] hover:bg-[#f5f5f5] hover:text-[#171717]'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="tbo-panel flex min-h-[240px] flex-col items-center justify-center py-16">
          <div
            className="w-6 h-6 border-2 border-amber-200 border-t-amber-600 rounded-full animate-spin"
            role="status"
            aria-label="Loading stream"
          />
          <p className="mt-3 text-sm text-[#737373]">{t('announcements.loading')}</p>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="tbo-panel grid min-h-[260px] place-items-center px-6 py-12 text-center">
          <div>
            <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-[#f5f5f5] text-[#737373]">
              <Megaphone className="h-6 w-6" />
            </span>
            <p className="text-sm text-[#737373]">
              {filter === 'all'
                ? t('announcements.empty')
                : `${t('announcements.emptyFiltered')} ${activeFilterLabel}`}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {pinnedList.length > 0 && (
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#737373]">
                <Pin className="h-3.5 w-3.5 text-[#d97706]" />
                <span>{t('announcements.pinned')}</span>
              </p>
              {pinnedList.map(renderCard)}
            </div>
          )}
          {regularList.length > 0 && (
            <div className="space-y-4">{regularList.map(renderCard)}</div>
          )}
        </div>
      )}

      <FilePreviewModal item={previewItem} onClose={() => setPreviewItem(null)} />
    </div>
  );
}
