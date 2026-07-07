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
} from 'lucide-react';
import type { Announcement, AnnouncementAttachment, User, Course, CourseStudent } from '../../types/lms';
import { hasRole } from '../../utils/userUtils';
import { getCourseDisplayName } from '../../utils/courseUtils';
import { CreateAnnouncementModal } from '../../components/modals/CreateAnnouncementModal';
import { PageHeader } from '../../components/ui/PageHeader';

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
  openCreateOnMount?: boolean;
  onCreateFlowClosed?: () => void;
}

type FilterValue = 'all' | Announcement['type'] | 'draft' | 'scheduled' | 'trash';

const FILTER_OPTIONS: { value: FilterValue; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'post', label: 'Posts' },
  { value: 'homework', label: 'Homework' },
  { value: 'material', label: 'Materials' },
  { value: 'system', label: 'System' },
  { value: 'scheduled', label: 'Scheduled' },
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
  if (minutes < 60) return `${Math.max(minutes, 1)} minutes ago`;
  if (hours < 24) return `${hours} hours ago`;
  if (days < 7) return `${days} days ago`;
  return new Date(dateString).toLocaleDateString();
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
  if (announcement.status === 'archived') return 'Trash';
  return null;
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

import { formatFileSize } from '../../utils/formatFileSize';

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
  return attachment.linkTitle ?? 'Google Slides';
}

function getAttachmentTypeLabel(attachment: AnnouncementAttachment): string {
  if (attachment.attachmentType === 'file') {
    return attachment.mimeType?.startsWith('image/') ? 'Image' : 'File';
  }
  if (attachment.attachmentType === 'google_doc') return 'Google Doc';
  if (attachment.attachmentType === 'google_sheet') return 'Google Sheet';
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
  return <Presentation className="h-4 w-4 flex-shrink-0" />;
}

function getAttachmentIconTone(attachment: AnnouncementAttachment): string {
  if (attachment.attachmentType === 'google_doc') return 'bg-blue-50 text-[#2563eb] ring-blue-100';
  if (attachment.attachmentType === 'google_sheet') return 'bg-emerald-50 text-[#16a34a] ring-emerald-100';
  if (attachment.attachmentType === 'google_slide') return 'bg-orange-50 text-[#ea580c] ring-orange-100';
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
}

function AnnouncementAttachmentsRow({
  attachments,
  currentUser,
  isAdmin,
  onDeleteAttachment,
}: AnnouncementAttachmentsRowProps) {
  if (attachments.length === 0) return null;

  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {attachments.map(attachment => {
        const openUrl = getAttachmentOpenUrl(attachment);
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
              <a
                href={openUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-w-0 items-center gap-2"
                title={getAttachmentLabel(attachment)}
              >
                {chipContent}
              </a>
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
  onRestore: (id: number) => Promise<void>;
  onPermanentDelete: (id: number) => void;
  onToggleReaction: (announcementId: number, emoji: string) => Promise<void>;
  onAddComment: (announcementId: number, content: string) => Promise<void>;
  onDeleteComment: (commentId: number) => void;
  onDeleteAttachment: (id: number, storagePath: string | null) => Promise<void>;
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
  onRestore,
  onPermanentDelete,
  onToggleReaction,
  onAddComment,
  onDeleteComment,
  onDeleteAttachment,
}: AnnouncementCardProps) {
  const typeBadge = TYPE_BADGE[announcement.type];
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
                    Edited
                  </span>
                </>
              )}
            </span>
          </div>
          {announcement.isPinned && !isArchived && (
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[#fff7ed] text-[#d97706]" title="Pinned">
              <Pin className="h-4 w-4" aria-label="Pinned" />
            </span>
          )}
          {isAdmin && !isArchived && (
            <button
              type="button"
              onClick={() => onTogglePin(announcement.id, announcement.isPinned)}
              className="tbo-focus rounded-lg p-1.5 text-[#a3a3a3] hover:bg-[#fff7ed] hover:text-[#d97706]"
              aria-label={announcement.isPinned ? 'Unpin announcement' : 'Pin announcement'}
            >
              <Pin className="w-4 h-4" />
            </button>
          )}
          {isArchived && isAdmin ? (
            <>
              <button
                type="button"
                onClick={() => onRestore(announcement.id)}
                className="tbo-focus rounded-lg p-1.5 text-[#a3a3a3] hover:bg-[#ecfdf5] hover:text-emerald-700"
                aria-label="Restore announcement"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onPermanentDelete(announcement.id)}
                className="tbo-focus rounded-lg p-1.5 text-[#a3a3a3] hover:bg-[#fef2f2] hover:text-red-600"
                aria-label="Permanently delete announcement"
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
                aria-label="Edit announcement"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(announcement.id)}
                className="tbo-focus rounded-lg p-1.5 text-[#a3a3a3] hover:bg-[#fef2f2] hover:text-red-600"
                aria-label="Delete announcement"
              >
                <Trash className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="px-5 py-4">
        <h3 className="text-xl font-semibold tracking-[-0.01em] text-[#171717]">{announcement.title}</h3>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#525252]">{announcement.content}</p>

        {announcement.attachments && announcement.attachments.length > 0 && (
          <div className="mt-4">
            <AnnouncementAttachmentsRow
              attachments={announcement.attachments}
              currentUser={currentUser}
              isAdmin={isAdmin}
              onDeleteAttachment={onDeleteAttachment}
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
              return (
                <button
                  key={emoji}
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
  openCreateOnMount = false,
  onCreateFlowClosed,
}: AnnouncementsViewProps) {
  const [filter, setFilter] = useState<FilterValue>('all');
  const [modalOpen, setModalOpen] = useState(openCreateOnMount);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [expandedComments, setExpandedComments] = useState<Set<number>>(new Set());
  const [commentDrafts, setCommentDrafts] = useState<Record<number, string>>({});

  const isAdmin = hasRole(currentUser, 'administrator');
  const canCreateAnnouncement =
    isAdmin || hasRole(currentUser, 'teacher');

  useEffect(() => {
    if (!openCreateOnMount || !canCreateAnnouncement) return;
    setEditingAnnouncement(null);
    setModalOpen(true);
  }, [canCreateAnnouncement, openCreateOnMount]);

  const visibleFilterOptions = FILTER_OPTIONS.filter(option => {
    if (option.value === 'trash') return isAdmin;
    if (option.value === 'scheduled' || option.value === 'draft') return canCreateAnnouncement;
    return true;
  });

  const filteredList =
    filter === 'all'
      ? announcements.filter(a => a.status !== 'archived')
      : filter === 'trash'
        ? announcements.filter(a => a.status === 'archived')
      : filter === 'scheduled' || filter === 'draft'
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
      onRestore={onRestore}
      onPermanentDelete={onPermanentDelete}
      onToggleReaction={onToggleReaction}
      onAddComment={onAddComment}
      onDeleteComment={onDeleteComment}
      onDeleteAttachment={onDeleteAttachment}
    />
  );

  if (modalOpen) {
    return (
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
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Announcements"
        action={
          canCreateAnnouncement ? (
            <button
              type="button"
              onClick={openCreateModal}
              className="tbo-focus flex w-full items-center justify-center gap-2 rounded-lg bg-[#171717] px-4 py-2 text-sm font-medium text-white hover:bg-[#404040] sm:w-auto"
            >
              <Plus className="w-4 h-4" />
              <span>New announcement</span>
            </button>
          ) : undefined
        }
      />

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
            aria-label="Loading announcements"
          />
          <p className="mt-3 text-sm text-[#737373]">Loading announcements...</p>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="tbo-panel grid min-h-[260px] place-items-center px-6 py-12 text-center">
          <div>
            <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-[#f5f5f5] text-[#737373]">
              <Megaphone className="h-6 w-6" />
            </span>
            <p className="text-sm text-[#737373]">
              {filter === 'all'
                ? 'No announcements yet.'
                : `No ${activeFilterLabel} announcements.`}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {pinnedList.length > 0 && (
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#737373]">
                <Pin className="h-3.5 w-3.5 text-[#d97706]" />
                <span>Pinned</span>
              </p>
              {pinnedList.map(renderCard)}
            </div>
          )}
          {regularList.length > 0 && (
            <div className="space-y-4">{regularList.map(renderCard)}</div>
          )}
        </div>
      )}

    </div>
  );
}
