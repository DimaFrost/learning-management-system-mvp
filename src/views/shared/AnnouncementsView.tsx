import { useState } from 'react';
import { Megaphone, Pin, Pencil, Trash, Plus, Lock } from 'lucide-react';
import type { Announcement, User, Course } from '../../types/lms';
import { hasRole } from '../../utils/userUtils';
import { getCourseDisplayName } from '../../utils/courseUtils';
import { CreateAnnouncementModal } from '../../components/modals/CreateAnnouncementModal';

interface AnnouncementsViewProps {
  announcements: Announcement[];
  courses: Course[];
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
  }) => Promise<void>;
  onUpdate: (id: number, updates: Partial<Announcement>) => Promise<void>;
  onDelete: (id: number) => void;
  onTogglePin: (id: number, current: boolean) => Promise<void>;
  onAddComment: (announcementId: number, content: string) => Promise<void>;
  onDeleteComment: (commentId: number) => void;
}

type FilterValue = 'all' | Announcement['type'];

const FILTER_OPTIONS: { value: FilterValue; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'post', label: 'Posts' },
  { value: 'homework', label: 'Homework' },
  { value: 'material', label: 'Materials' },
  { value: 'system', label: 'System' },
];

const TYPE_BADGE: Record<
  Announcement['type'],
  { label: string; emoji: string; className: string }
> = {
  post: { label: 'Post', emoji: '📢', className: 'bg-blue-100 text-blue-800' },
  homework: { label: 'Homework', emoji: '📚', className: 'bg-amber-100 text-amber-800' },
  material: { label: 'Material', emoji: '📄', className: 'bg-green-100 text-green-800' },
  system: { label: 'System', emoji: '⚙️', className: 'bg-gray-100 text-gray-800' },
};

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
  onAddComment: (announcementId: number, content: string) => Promise<void>;
  onDeleteComment: (commentId: number) => void;
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
  onAddComment,
  onDeleteComment,
}: AnnouncementCardProps) {
  const typeBadge = TYPE_BADGE[announcement.type];
  const course =
    announcement.courseId !== null
      ? courses.find(c => c.id === announcement.courseId)
      : undefined;
  const comments = announcement.comments ?? [];
  const commentCount = comments.length;
  const canManage = isAdmin || announcement.authorId === currentUser.id;

  const handlePostComment = async () => {
    const content = commentDraft.trim();
    if (!content) return;
    await onAddComment(announcement.id, content);
    onCommentDraftChange('');
  };

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${typeBadge.className}`}
          >
            {typeBadge.emoji} {typeBadge.label}
          </span>
          {announcement.isStaffOnly && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
              <Lock className="w-3 h-3" />
              Staff only
            </span>
          )}
          {course && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
              {getCourseDisplayName(course)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {announcement.isPinned && (
            <Pin className="w-4 h-4 text-amber-600" aria-label="Pinned" />
          )}
          {isAdmin && (
            <button
              type="button"
              onClick={() => onTogglePin(announcement.id, announcement.isPinned)}
              className="p-1.5 text-gray-400 hover:text-amber-600 rounded-md hover:bg-gray-100"
              aria-label={announcement.isPinned ? 'Unpin announcement' : 'Pin announcement'}
            >
              <Pin className="w-4 h-4" />
            </button>
          )}
          {canManage && (
            <>
              <button
                type="button"
                onClick={() => onEdit(announcement)}
                className="p-1.5 text-gray-400 hover:text-blue-600 rounded-md hover:bg-gray-100"
                aria-label="Edit announcement"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(announcement.id)}
                className="p-1.5 text-gray-400 hover:text-red-600 rounded-md hover:bg-gray-100"
                aria-label="Delete announcement"
              >
                <Trash className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      <h3 className="text-xl font-bold text-gray-900 mb-2">{announcement.title}</h3>
      <p className="text-gray-700 whitespace-pre-wrap mb-3">{announcement.content}</p>
      <p className="text-sm text-gray-500 mb-4">
        {announcement.authorName ?? 'Unknown'} · {formatRelativeTime(announcement.createdAt)}
      </p>

      <div className="border-t border-gray-100 pt-3">
        <button
          type="button"
          onClick={onToggleComments}
          className="text-sm text-amber-700 hover:text-amber-900 font-medium"
        >
          {commentCount} comment{commentCount !== 1 ? 's' : ''}
        </button>

        {isCommentsExpanded && (
          <div className="mt-3 space-y-3">
            {comments.length === 0 ? (
              <p className="text-sm text-gray-500">No comments yet.</p>
            ) : (
              comments.map(comment => (
                <div key={comment.id} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{comment.authorName}</p>
                      <p className="text-sm text-gray-700 mt-1">{comment.content}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatRelativeTime(comment.createdAt)}
                      </p>
                    </div>
                    {comment.authorId === currentUser.id && (
                      <button
                        type="button"
                        onClick={() => onDeleteComment(comment.id)}
                        className="text-xs text-red-600 hover:text-red-800 flex-shrink-0"
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
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={handlePostComment}
                disabled={!commentDraft.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Post
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function AnnouncementsView({
  announcements,
  courses,
  currentUser,
  loading,
  onAdd,
  onUpdate,
  onDelete,
  onTogglePin,
  onAddComment,
  onDeleteComment,
}: AnnouncementsViewProps) {
  const [filter, setFilter] = useState<FilterValue>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [expandedComments, setExpandedComments] = useState<Set<number>>(new Set());
  const [commentDrafts, setCommentDrafts] = useState<Record<number, string>>({});

  const isAdmin = hasRole(currentUser, 'administrator');
  const canCreateAnnouncement =
    isAdmin || hasRole(currentUser, 'teacher');

  const filteredList =
    filter === 'all' ? announcements : announcements.filter(a => a.type === filter);

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

  const closeModal = () => {
    setModalOpen(false);
    setEditingAnnouncement(null);
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
      onAddComment={onAddComment}
      onDeleteComment={onDeleteComment}
    />
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Announcements</h2>
        {canCreateAnnouncement && (
          <button
            type="button"
            onClick={openCreateModal}
            className="bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>New Announcement</span>
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map(option => (
          <button
            key={option.value}
            type="button"
            onClick={() => setFilter(option.value)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === option.value
                ? 'bg-amber-100 text-amber-800 border border-amber-500'
                : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 min-h-[200px] rounded-lg border border-gray-200 bg-white">
          <div
            className="w-6 h-6 border-2 border-amber-200 border-t-amber-600 rounded-full animate-spin"
            role="status"
            aria-label="Loading announcements"
          />
          <p className="text-sm text-gray-400 mt-3">Loading announcements...</p>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="text-center py-12">
          <Megaphone className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">
            {filter === 'all'
              ? 'No announcements yet.'
              : `No ${activeFilterLabel} announcements.`}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {pinnedList.length > 0 && (
            <div className="space-y-4">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                📌 Pinned
              </p>
              {pinnedList.map(renderCard)}
            </div>
          )}
          {regularList.length > 0 && (
            <div className="space-y-4">{regularList.map(renderCard)}</div>
          )}
        </div>
      )}

      <CreateAnnouncementModal
        isOpen={modalOpen}
        editingAnnouncement={editingAnnouncement}
        courses={courses}
        currentUser={currentUser}
        onClose={closeModal}
        onSubmit={async data => {
          if (editingAnnouncement) {
            await onUpdate(editingAnnouncement.id, { ...data });
          } else {
            await onAdd(data);
          }
        }}
      />
    </div>
  );
}
