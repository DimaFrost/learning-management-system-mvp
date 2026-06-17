import { useState, useEffect, useMemo, useRef, type FormEvent } from 'react';
import {
  Pin,
  Users,
  X,
  Paperclip,
  FileText,
  Link,
  Table,
  Presentation,
  ExternalLink,
} from 'lucide-react';
import type { Announcement, AnnouncementAttachment, Course, User } from '../../types/lms';
import { hasRole } from '../../utils/userUtils';
import { getCourseDisplayName } from '../../utils/courseUtils';

type PendingAttachment = {
  id: string;
  file?: File;
  attachmentType: AnnouncementAttachment['attachmentType'];
  linkUrl?: string;
  linkTitle?: string;
};

type GoogleLinkType = 'google_doc' | 'google_sheet' | 'google_slide';

interface CreateAnnouncementModalProps {
  isOpen: boolean;
  editingAnnouncement: Announcement | null;
  announcementId: number | null;
  existingAttachments: AnnouncementAttachment[];
  courses: Course[];
  currentUser: User;
  onClose: () => void;
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
  onSubmit: (data: {
    title: string;
    content: string;
    type: Announcement['type'];
    courseId: number | null;
    targetRoles: string[] | null;
    isPinned: boolean;
    isStaffOnly: boolean;
  }) => Promise<number>;
}

function AttachmentTypeIcon({
  type,
  className = 'w-4 h-4',
}: {
  type: AnnouncementAttachment['attachmentType'];
  className?: string;
}) {
  switch (type) {
    case 'file':
      return <FileText className={className} />;
    case 'google_doc':
      return <FileText className={className} />;
    case 'google_sheet':
      return <Table className={className} />;
    case 'google_slide':
      return <Presentation className={className} />;
    default:
      return <Link className={className} />;
  }
}

function getAttachmentLabel(attachment: AnnouncementAttachment | PendingAttachment): string {
  if ('fileName' in attachment && attachment.fileName) return attachment.fileName;
  if ('file' in attachment && attachment.file) return attachment.file.name;
  if ('linkTitle' in attachment && attachment.linkTitle) return attachment.linkTitle;
  if ('linkUrl' in attachment && attachment.linkUrl) return attachment.linkUrl;
  return 'Attachment';
}

function getAttachmentUrl(attachment: AnnouncementAttachment): string | null {
  return attachment.publicUrl ?? attachment.linkUrl;
}

export function CreateAnnouncementModal({
  isOpen,
  editingAnnouncement,
  announcementId,
  existingAttachments,
  courses,
  currentUser,
  onClose,
  onAddAttachment,
  onDeleteAttachment,
  onSubmit,
}: CreateAnnouncementModalProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [audience, setAudience] = useState<'school-wide' | 'course'>('school-wide');
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  const [isStaffOnly, setIsStaffOnly] = useState(false);
  const [errors, setErrors] = useState<{
    title?: string;
    content?: string;
    course?: string;
    link?: string;
  }>({});
  const [submitting, setSubmitting] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [linkFormOpen, setLinkFormOpen] = useState(false);
  const [linkType, setLinkType] = useState<GoogleLinkType>('google_doc');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [attaching, setAttaching] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEditing = editingAnnouncement !== null;
  const isAdmin = hasRole(currentUser, 'administrator');
  const isTeacherNotAdmin = hasRole(currentUser, 'teacher') && !isAdmin;

  const availableCourses = useMemo(() => {
    if (isTeacherNotAdmin) {
      return courses.filter(course =>
        course.subjects.some(subject =>
          subject.classes.some(cls => cls.teacherId === currentUser.id)
        )
      );
    }
    return courses;
  }, [courses, currentUser.id, isTeacherNotAdmin]);

  useEffect(() => {
    if (!isOpen) return;

    if (editingAnnouncement) {
      setTitle(editingAnnouncement.title);
      setContent(editingAnnouncement.content);
      setAudience(
        isTeacherNotAdmin || editingAnnouncement.courseId !== null ? 'course' : 'school-wide'
      );
      setSelectedCourseId(
        editingAnnouncement.courseId ?? availableCourses[0]?.id ?? null
      );
      setIsPinned(editingAnnouncement.isPinned);
      setIsStaffOnly(editingAnnouncement.isStaffOnly);
    } else {
      setTitle('');
      setContent('');
      if (isTeacherNotAdmin) {
        setAudience('course');
        setSelectedCourseId(availableCourses[0]?.id ?? null);
      } else {
        setAudience('school-wide');
        setSelectedCourseId(courses[0]?.id ?? null);
      }
      setIsPinned(false);
      setIsStaffOnly(false);
    }
    setErrors({});
    setSubmitting(false);
    setPendingAttachments([]);
    setLinkFormOpen(false);
    setLinkType('google_doc');
    setLinkUrl('');
    setLinkTitle('');
    setAttaching(false);
  }, [isOpen, editingAnnouncement, courses, availableCourses, isTeacherNotAdmin]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (announcementId !== null) {
      setAttaching(true);
      try {
        await onAddAttachment(announcementId, { file, attachmentType: 'file' });
      } catch {
        // Parent hook sets error state
      } finally {
        setAttaching(false);
      }
    } else {
      setPendingAttachments(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          file,
          attachmentType: 'file',
        },
      ]);
    }
  };

  const handleAddLink = async () => {
    if (!linkUrl.includes('docs.google.com')) {
      setErrors(prev => ({ ...prev, link: 'Please paste a valid Google Docs link' }));
      return;
    }
    setErrors(prev => ({ ...prev, link: undefined }));

    const attachment = {
      attachmentType: linkType,
      linkUrl: linkUrl.trim(),
      linkTitle: linkTitle.trim() || undefined,
    };

    if (announcementId !== null) {
      setAttaching(true);
      try {
        await onAddAttachment(announcementId, attachment);
        setLinkUrl('');
        setLinkTitle('');
        setLinkFormOpen(false);
      } catch {
        // Parent hook sets error state
      } finally {
        setAttaching(false);
      }
    } else {
      setPendingAttachments(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          ...attachment,
        },
      ]);
      setLinkUrl('');
      setLinkTitle('');
      setLinkFormOpen(false);
    }
  };

  const removePending = (id: string) => {
    setPendingAttachments(prev => prev.filter(p => p.id !== id));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const newErrors: { title?: string; content?: string; course?: string } = {};

    if (!title.trim()) {
      newErrors.title = 'Title is required';
    }
    if (!content.trim()) {
      newErrors.content = 'Content is required';
    }
    const effectiveAudience = isTeacherNotAdmin ? 'course' : audience;
    if (effectiveAudience === 'course' && selectedCourseId === null) {
      newErrors.course = 'Please select a course';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);
    try {
      const newId = await onSubmit({
        title: title.trim(),
        content: content.trim(),
        type: 'post',
        courseId: effectiveAudience === 'school-wide' ? null : selectedCourseId,
        targetRoles: null,
        isPinned,
        isStaffOnly,
      });

      if (!isEditing) {
        for (const pending of pendingAttachments) {
          await onAddAttachment(newId, {
            file: pending.file,
            attachmentType: pending.attachmentType,
            linkUrl: pending.linkUrl,
            linkTitle: pending.linkTitle,
          });
        }
      }

      onClose();
    } catch {
      // Parent hook sets error state; keep modal open
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const showCourseSelect = isTeacherNotAdmin || audience === 'course';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <h3 className="text-lg font-semibold text-gray-900">
              {isEditing ? 'Edit Announcement' : 'Create Announcement'}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="announcement-title" className="block text-sm font-medium text-gray-700 mb-1">
                Title
              </label>
              <input
                id="announcement-title"
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                placeholder="Announcement title"
                required
              />
              {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title}</p>}
            </div>

            <div>
              <label htmlFor="announcement-content" className="block text-sm font-medium text-gray-700 mb-1">
                Content
              </label>
              <textarea
                id="announcement-content"
                value={content}
                onChange={e => setContent(e.target.value)}
                rows={4}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                placeholder="Write your announcement..."
                required
              />
              {errors.content && <p className="text-red-500 text-sm mt-1">{errors.content}</p>}
            </div>

            <div>
              <span className="block text-sm font-medium text-gray-700 mb-2">Audience</span>
              {isAdmin && (
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="audience"
                      value="school-wide"
                      checked={audience === 'school-wide'}
                      onChange={() => setAudience('school-wide')}
                      className="text-amber-600 focus:ring-amber-500"
                    />
                    <span className="text-sm text-gray-700">School-wide (all users)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="audience"
                      value="course"
                      checked={audience === 'course'}
                      onChange={() => setAudience('course')}
                      className="text-amber-600 focus:ring-amber-500"
                    />
                    <span className="text-sm text-gray-700">Specific course</span>
                  </label>
                </div>
              )}
              {isTeacherNotAdmin && (
                <p className="text-sm text-gray-700 mb-2">Specific course</p>
              )}
              {showCourseSelect && (
                <select
                  value={selectedCourseId ?? ''}
                  onChange={e =>
                    setSelectedCourseId(e.target.value ? Number(e.target.value) : null)
                  }
                  className={`${isAdmin ? 'mt-2' : ''} w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-transparent`}
                >
                  <option value="">Select a course</option>
                  {availableCourses.map(course => (
                    <option key={course.id} value={course.id}>
                      {getCourseDisplayName(course)}
                    </option>
                  ))}
                </select>
              )}
              {errors.course && <p className="text-red-500 text-sm mt-1">{errors.course}</p>}
            </div>

            <div className="flex items-start justify-between gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-start gap-2">
                <Users className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Staff only</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Students will not see this announcement
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isStaffOnly}
                onClick={() => setIsStaffOnly(prev => !prev)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 ${
                  isStaffOnly ? 'bg-amber-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isStaffOnly ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
              <div className="flex items-center gap-2">
                <Paperclip className="w-5 h-5 text-amber-600" />
                <h4 className="text-sm font-medium text-gray-900">Attachments</h4>
              </div>

              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileSelect}
                  disabled={attaching || submitting}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={attaching || submitting}
                  className="text-sm px-3 py-1.5 border border-gray-300 rounded-full bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  📎 Attach file
                </button>
                <button
                  type="button"
                  onClick={() => setLinkFormOpen(prev => !prev)}
                  disabled={attaching || submitting}
                  className="text-sm px-3 py-1.5 border border-gray-300 rounded-full bg-white hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1"
                >
                  <Link className="w-3.5 h-3.5" />
                  Link Google Doc
                </button>
              </div>

              {linkFormOpen && (
                <div className="space-y-3 p-3 bg-white rounded-lg border border-gray-200">
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        { type: 'google_doc' as const, label: 'Doc' },
                        { type: 'google_sheet' as const, label: 'Sheet' },
                        { type: 'google_slide' as const, label: 'Slide' },
                      ] as const
                    ).map(({ type, label }) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setLinkType(type)}
                        className={`px-3 py-1 rounded-full text-xs font-medium border ${
                          linkType === type
                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                            : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <input
                    type="url"
                    value={linkUrl}
                    onChange={e => setLinkUrl(e.target.value)}
                    placeholder="Paste Google link"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                  <input
                    type="text"
                    value={linkTitle}
                    onChange={e => setLinkTitle(e.target.value)}
                    placeholder="Label (optional)"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                  {errors.link && <p className="text-red-500 text-sm">{errors.link}</p>}
                  <button
                    type="button"
                    onClick={handleAddLink}
                    disabled={!linkUrl.trim() || attaching}
                    className="text-sm px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50"
                  >
                    Add Link
                  </button>
                </div>
              )}

              {announcementId !== null && existingAttachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {existingAttachments.map(attachment => {
                    const url = getAttachmentUrl(attachment);
                    return (
                      <div
                        key={attachment.id}
                        className="inline-flex items-center gap-1.5 pl-2 pr-1 py-1 bg-white border border-gray-200 rounded-full text-sm"
                      >
                        <AttachmentTypeIcon type={attachment.attachmentType} className="w-3.5 h-3.5 text-gray-500" />
                        <span className="text-gray-700 max-w-[140px] truncate">
                          {getAttachmentLabel(attachment)}
                        </span>
                        {url && (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-gray-400 hover:text-amber-700"
                            aria-label="Open attachment"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            onDeleteAttachment(attachment.id, attachment.storagePath)
                          }
                          disabled={attaching}
                          className="p-1 text-gray-400 hover:text-red-600 disabled:opacity-50"
                          aria-label="Remove attachment"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {announcementId === null && pendingAttachments.length > 0 && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {pendingAttachments.map(pending => (
                      <div
                        key={pending.id}
                        className="inline-flex items-center gap-1.5 pl-2 pr-1 py-1 bg-white border border-gray-200 rounded-full text-sm"
                      >
                        <AttachmentTypeIcon type={pending.attachmentType} className="w-3.5 h-3.5 text-gray-500" />
                        <span className="text-gray-700 max-w-[140px] truncate">
                          {getAttachmentLabel(pending)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removePending(pending.id)}
                          className="p-1 text-gray-400 hover:text-red-600"
                          aria-label="Remove pending attachment"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500">
                    These will be attached when you post the announcement.
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-start justify-between gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-start gap-2">
                <Pin className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Pin this announcement</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Pinned announcements appear at the top of the feed
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isPinned}
                onClick={() => setIsPinned(prev => !prev)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 ${
                  isPinned ? 'bg-amber-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isPinned ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || attaching}
                className="px-4 py-2 text-sm font-medium text-white bg-amber-600 border border-transparent rounded-md hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Post Announcement'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
