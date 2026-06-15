import { useState, useEffect, useMemo, type FormEvent } from 'react';
import { Pin, Users, X } from 'lucide-react';
import type { Announcement, Course, User } from '../../types/lms';
import { hasRole } from '../../utils/userUtils';
import { getCourseDisplayName } from '../../utils/courseUtils';

interface CreateAnnouncementModalProps {
  isOpen: boolean;
  editingAnnouncement: Announcement | null;
  courses: Course[];
  currentUser: User;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    content: string;
    type: Announcement['type'];
    courseId: number | null;
    targetRoles: string[] | null;
    isPinned: boolean;
    isStaffOnly: boolean;
  }) => Promise<void>;
}

export function CreateAnnouncementModal({
  isOpen,
  editingAnnouncement,
  courses,
  currentUser,
  onClose,
  onSubmit,
}: CreateAnnouncementModalProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [audience, setAudience] = useState<'school-wide' | 'course'>('school-wide');
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  const [isStaffOnly, setIsStaffOnly] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; content?: string; course?: string }>({});
  const [submitting, setSubmitting] = useState(false);

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
  }, [isOpen, editingAnnouncement, courses, availableCourses, isTeacherNotAdmin]);

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
      await onSubmit({
        title: title.trim(),
        content: content.trim(),
        type: 'post',
        courseId: effectiveAudience === 'school-wide' ? null : selectedCourseId,
        targetRoles: null,
        isPinned,
        isStaffOnly,
      });
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
                disabled={submitting}
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
