import { useEffect, useMemo, useRef, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  FileText,
  Globe2,
  Image,
  Link,
  Paperclip,
  Pin,
  Presentation,
  Search,
  Table,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import type { Announcement, AnnouncementAttachment, Course, CourseStudent, User } from '../../types/lms';
import { hasRole } from '../../utils/userUtils';
import { formatPlatformDateTime } from '../../utils/dateUtils';
import { canPreviewInApp, canPreviewLocalFile, resolveAnnouncementPreview, resolveLocalFilePreview } from '../../utils/filePreview';
import type { FilePreviewItem } from '../../utils/filePreview';
import { FilePreviewModal } from './FilePreviewModal';

type PendingAttachment = {
  id: string;
  file?: File;
  attachmentType: AnnouncementAttachment['attachmentType'];
  linkUrl?: string;
  linkTitle?: string;
};

type GoogleLinkType = 'google_doc' | 'google_sheet' | 'google_slide';
type AudienceGroup = 'all' | 'staff' | 'students' | 'custom';
type AudienceSubChoice = 'staff' | 'teachers' | 'translators' | 'first_year_students' | 'second_year_students';
type DeliveryMode = 'now' | 'schedule' | 'draft';
type ContentLanguage = 'en' | 'bg';

const CUSTOM_USER_PREFIX = 'user:';

const AUDIENCE_TOKEN: Record<AudienceSubChoice, string> = {
  staff: 'audience:staff',
  teachers: 'role:teacher',
  translators: 'role:translator',
  first_year_students: 'course:first_year',
  second_year_students: 'course:second_year',
};

const DEFAULT_STAFF_AUDIENCES: AudienceSubChoice[] = ['staff'];
const DEFAULT_STUDENT_AUDIENCES: AudienceSubChoice[] = ['first_year_students', 'second_year_students'];

interface CreateAnnouncementModalProps {
  isOpen: boolean;
  editingAnnouncement: Announcement | null;
  announcementId: number | null;
  existingAttachments: AnnouncementAttachment[];
  courses: Course[];
  users: User[];
  courseStudents: CourseStudent[];
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
}

function AttachmentTypeIcon({
  type,
  mimeType,
  className = 'h-4 w-4',
}: {
  type: AnnouncementAttachment['attachmentType'];
  mimeType?: string | null;
  className?: string;
}) {
  if (type === 'file' && mimeType?.startsWith('image/')) return <Image className={className} />;
  if (type === 'google_sheet') return <Table className={className} />;
  if (type === 'google_slide') return <Presentation className={className} />;
  if (type === 'google_doc' || type === 'file') return <FileText className={className} />;
  return <Link className={className} />;
}

function getAttachmentLabel(attachment: AnnouncementAttachment | PendingAttachment): string {
  if ('linkTitle' in attachment && attachment.linkTitle) return attachment.linkTitle;
  if ('fileName' in attachment && attachment.fileName) return attachment.fileName;
  if ('file' in attachment && attachment.file) return attachment.file.name;
  if ('linkUrl' in attachment && attachment.linkUrl) return attachment.linkUrl;
  return 'Attachment';
}

function getAttachmentUrl(attachment: AnnouncementAttachment): string | null {
  return attachment.publicUrl ?? attachment.linkUrl;
}

function getAttachmentTypeLabel(
  type: AnnouncementAttachment['attachmentType'],
  file?: File,
  mimeType?: string | null
): string {
  if (type === 'file') {
    const fileType = file?.type || mimeType || '';
    return fileType.startsWith('image/') ? 'Image file' : 'File';
  }
  if (type === 'google_doc') return 'Google Doc';
  if (type === 'google_sheet') return 'Google Sheet';
  return 'Google Slides';
}

function getAttachmentTone(type: AnnouncementAttachment['attachmentType'], mimeType?: string | null) {
  if (type === 'file' && mimeType?.startsWith('image/')) return 'bg-rose-50 text-rose-700 ring-rose-100';
  if (type === 'google_doc') return 'bg-blue-50 text-blue-700 ring-blue-100';
  if (type === 'google_sheet') return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
  if (type === 'google_slide') return 'bg-orange-50 text-orange-700 ring-orange-100';
  return 'bg-gray-100 text-gray-600 ring-gray-200';
}

function toDateTimeLocalValue(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function getRealRoles(user: User) {
  return user.roles.filter(role => role !== 'dev');
}

function isStaffAudienceUser(user: User) {
  const realRoles = getRealRoles(user);
  return realRoles.some(role =>
    ['administrator', 'teacher', 'mentor', 'team_leader'].includes(role)
  );
}

function getAudienceStateFromAnnouncement(announcement: Announcement, courses: Course[]) {
  const tokens = announcement.targetRoles ?? [];
  const staffAudiences: AudienceSubChoice[] = [];
  const studentAudiences: AudienceSubChoice[] = [];

  if (tokens.includes(AUDIENCE_TOKEN.staff) || announcement.isStaffOnly) staffAudiences.push('staff');
  if (tokens.includes(AUDIENCE_TOKEN.teachers)) staffAudiences.push('teachers');
  if (tokens.includes(AUDIENCE_TOKEN.translators)) staffAudiences.push('translators');
  if (tokens.includes(AUDIENCE_TOKEN.first_year_students)) studentAudiences.push('first_year_students');
  if (tokens.includes(AUDIENCE_TOKEN.second_year_students)) studentAudiences.push('second_year_students');
  if (announcement.courseId !== null) {
    const course = courses.find(item => item.id === announcement.courseId);
    if (course?.courseType === 'first_year' && !studentAudiences.includes('first_year_students')) {
      studentAudiences.push('first_year_students');
    }
    if (course?.courseType === 'second_year' && !studentAudiences.includes('second_year_students')) {
      studentAudiences.push('second_year_students');
    }
  }

  const customUserIds = getCustomUserIdsFromTokens(tokens);
  const allSelected =
    tokens.length === 0 &&
    announcement.courseId === null &&
    !announcement.isStaffOnly;

  return {
    allSelected,
    staffSelected: staffAudiences.length > 0,
    studentSelected: studentAudiences.length > 0,
    customSelected: customUserIds.length > 0,
    staffAudiences: staffAudiences.length > 0 ? staffAudiences : DEFAULT_STAFF_AUDIENCES,
    studentAudiences: studentAudiences.length > 0 ? studentAudiences : DEFAULT_STUDENT_AUDIENCES,
    customUserIds,
  };
}

function getCustomUserIdsFromTokens(tokens: string[] | null) {
  return (tokens ?? [])
    .filter(token => token.startsWith(CUSTOM_USER_PREFIX))
    .map(token => token.slice(CUSTOM_USER_PREFIX.length));
}

function getAudienceTokens({
  allSelected,
  staffSelected,
  studentSelected,
  customSelected,
  staffAudiences,
  studentAudiences,
  customUserIds,
}: {
  allSelected: boolean;
  staffSelected: boolean;
  studentSelected: boolean;
  customSelected: boolean;
  staffAudiences: AudienceSubChoice[];
  studentAudiences: AudienceSubChoice[];
  customUserIds: string[];
}): string[] | null {
  if (allSelected) return null;

  const tokens = new Set<string>();
  if (staffSelected) staffAudiences.forEach(item => tokens.add(AUDIENCE_TOKEN[item]));
  if (studentSelected) studentAudiences.forEach(item => tokens.add(AUDIENCE_TOKEN[item]));
  if (customSelected) customUserIds.forEach(id => tokens.add(`${CUSTOM_USER_PREFIX}${id}`));

  return Array.from(tokens);
}

function getAudienceSummaryLabel(tokens: string[] | null) {
  if (tokens === null) return 'All';
  const labels: string[] = [];
  if (tokens.includes(AUDIENCE_TOKEN.staff)) labels.push('Staff');
  if (tokens.includes(AUDIENCE_TOKEN.teachers)) labels.push('Teachers');
  if (tokens.includes(AUDIENCE_TOKEN.translators)) labels.push('Translators');
  if (tokens.includes(AUDIENCE_TOKEN.first_year_students)) labels.push('First Year');
  if (tokens.includes(AUDIENCE_TOKEN.second_year_students)) labels.push('Second Year');
  if (tokens.some(token => token.startsWith(CUSTOM_USER_PREFIX))) labels.push('Custom');
  return labels.length > 0 ? labels.join(', ') : 'No audience';
}

function formatRoleLabel(role: string) {
  return role
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts.slice(0, 2).map(part => part[0]?.toUpperCase()).join('');
}

function UserAvatar({
  user,
  size = 'md',
}: {
  user: User;
  size?: 'sm' | 'md';
}) {
  const sizeClass = size === 'sm' ? 'h-7 w-7 text-[10px]' : 'h-9 w-9 text-xs';

  return (
    <span className={`grid flex-shrink-0 place-items-center overflow-hidden rounded-full border border-white bg-[#f5f5f5] font-semibold text-[#525252] shadow-[0_0_0_1px_rgba(229,229,229,0.95)] ${sizeClass}`}>
      {user.avatarUrl ? (
        <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        getInitials(user.name)
      )}
    </span>
  );
}

function UserAvatarStack({
  users,
  max = 5,
}: {
  users: User[];
  max?: number;
}) {
  const visibleUsers = users.slice(0, max);
  const extraCount = Math.max(0, users.length - visibleUsers.length);

  if (users.length === 0) return null;

  return (
    <span className="flex items-center -space-x-2">
      {visibleUsers.map(user => (
        <UserAvatar key={user.id} user={user} size="sm" />
      ))}
      {extraCount > 0 && (
        <span className="grid h-7 min-w-7 place-items-center rounded-full border border-white bg-[#171717] px-1.5 text-[10px] font-semibold text-white shadow-[0_0_0_1px_rgba(23,23,23,0.08)]">
          +{extraCount}
        </span>
      )}
    </span>
  );
}

function getRecipientIds({
  targetRoles,
  users,
  courses,
  courseStudents,
}: {
  targetRoles: string[] | null;
  users: User[];
  courses: Course[];
  courseStudents: CourseStudent[];
}) {
  const ids = new Set<string>();
  const activeEnrollments = courseStudents.filter(enrollment => enrollment.status === 'active');

  if (targetRoles === null) {
    users.forEach(user => ids.add(user.id));
    return ids;
  }

  if (targetRoles.includes(AUDIENCE_TOKEN.staff)) {
    users.filter(isStaffAudienceUser).forEach(user => ids.add(user.id));
  }
  if (targetRoles.includes(AUDIENCE_TOKEN.teachers)) {
    users.filter(user => user.roles.includes('teacher')).forEach(user => ids.add(user.id));
  }
  if (targetRoles.includes(AUDIENCE_TOKEN.translators)) {
    users.filter(user => user.roles.includes('translator')).forEach(user => ids.add(user.id));
  }

  (['first_year_students', 'second_year_students'] as const).forEach(studentAudience => {
    const token = AUDIENCE_TOKEN[studentAudience];
    if (!targetRoles.includes(token)) return;
    const courseType = studentAudience === 'first_year_students' ? 'first_year' : 'second_year';
    const courseIds = new Set(courses.filter(course => course.courseType === courseType).map(course => course.id));
    activeEnrollments
      .filter(enrollment => courseIds.has(enrollment.courseId))
      .forEach(enrollment => ids.add(enrollment.studentId));
  });

  targetRoles
    .filter(token => token.startsWith(CUSTOM_USER_PREFIX))
    .forEach(token => ids.add(token.slice(CUSTOM_USER_PREFIX.length)));

  return ids;
}

export function CreateAnnouncementModal({
  isOpen,
  editingAnnouncement,
  announcementId,
  existingAttachments,
  courses,
  users,
  courseStudents,
  currentUser,
  onClose,
  onAddAttachment,
  onDeleteAttachment,
  onSubmit,
}: CreateAnnouncementModalProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [titleBg, setTitleBg] = useState('');
  const [contentBg, setContentBg] = useState('');
  const [contentLanguage, setContentLanguage] = useState<ContentLanguage>('en');
  const [allAudienceSelected, setAllAudienceSelected] = useState(true);
  const [staffAudienceSelected, setStaffAudienceSelected] = useState(false);
  const [studentAudienceSelected, setStudentAudienceSelected] = useState(false);
  const [customAudienceSelected, setCustomAudienceSelected] = useState(false);
  const [staffAudiences, setStaffAudiences] = useState<AudienceSubChoice[]>(DEFAULT_STAFF_AUDIENCES);
  const [studentAudiences, setStudentAudiences] = useState<AudienceSubChoice[]>(DEFAULT_STUDENT_AUDIENCES);
  const [customUserIds, setCustomUserIds] = useState<string[]>([]);
  const [customPickerOpen, setCustomPickerOpen] = useState(false);
  const [customSearch, setCustomSearch] = useState('');
  const [customPage, setCustomPage] = useState(0);
  const [isPinned, setIsPinned] = useState(false);
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>('now');
  const [scheduledAtLocal, setScheduledAtLocal] = useState('');
  const [notifyAudience, setNotifyAudience] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; content?: string; course?: string; link?: string; file?: string; schedule?: string; language?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [linkFormOpen, setLinkFormOpen] = useState(false);
  const [linkType, setLinkType] = useState<GoogleLinkType>('google_doc');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileTitle, setFileTitle] = useState('');
  const [attaching, setAttaching] = useState(false);
  const [previewItem, setPreviewItem] = useState<FilePreviewItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEditing = editingAnnouncement !== null;
  const isEditingPublished = editingAnnouncement?.status === 'published';
  const isAdmin = hasRole(currentUser, 'administrator');
  const isTeacherNotAdmin = hasRole(currentUser, 'teacher') && !isAdmin;

  useEffect(() => {
    if (!isOpen) return;

    if (editingAnnouncement) {
      setTitle(editingAnnouncement.title);
      setContent(editingAnnouncement.content);
      setTitleBg(editingAnnouncement.titleBg ?? '');
      setContentBg(editingAnnouncement.contentBg ?? '');
      setContentLanguage(editingAnnouncement.title || editingAnnouncement.content ? 'en' : 'bg');
      const nextAudience = getAudienceStateFromAnnouncement(editingAnnouncement, courses);
      if (isTeacherNotAdmin) {
        setAllAudienceSelected(false);
        setStaffAudienceSelected(true);
        setStudentAudienceSelected(false);
        setCustomAudienceSelected(false);
        setStaffAudiences(['teachers']);
        setStudentAudiences(DEFAULT_STUDENT_AUDIENCES);
        setCustomUserIds([]);
      } else {
        setAllAudienceSelected(nextAudience.allSelected);
        setStaffAudienceSelected(nextAudience.staffSelected);
        setStudentAudienceSelected(nextAudience.studentSelected);
        setCustomAudienceSelected(nextAudience.customSelected);
        setStaffAudiences(nextAudience.staffAudiences);
        setStudentAudiences(nextAudience.studentAudiences);
        setCustomUserIds(nextAudience.customUserIds);
      }
      setIsPinned(editingAnnouncement.isPinned);
      if (editingAnnouncement.status === 'draft') {
        setDeliveryMode('draft');
      } else if (editingAnnouncement.status === 'scheduled') {
        setDeliveryMode('schedule');
      } else {
        setDeliveryMode('now');
      }
      setScheduledAtLocal(toDateTimeLocalValue(editingAnnouncement.scheduledAt));
    } else {
      setTitle('');
      setContent('');
      setTitleBg('');
      setContentBg('');
      setContentLanguage('en');
      setAllAudienceSelected(!isTeacherNotAdmin);
      setStaffAudienceSelected(isTeacherNotAdmin);
      setStudentAudienceSelected(false);
      setCustomAudienceSelected(false);
      setStaffAudiences(isTeacherNotAdmin ? ['teachers'] : DEFAULT_STAFF_AUDIENCES);
      setStudentAudiences(DEFAULT_STUDENT_AUDIENCES);
      setCustomUserIds([]);
      setIsPinned(false);
      setDeliveryMode('now');
      setScheduledAtLocal('');
    }

    setErrors({});
    setSubmitting(false);
    setPendingAttachments([]);
    setLinkFormOpen(false);
    setLinkType('google_doc');
    setLinkUrl('');
    setLinkTitle('');
    setSelectedFile(null);
    setFileTitle('');
    setCustomPickerOpen(false);
    setCustomSearch('');
    setCustomPage(0);
    setNotifyAudience(false);
    setAttaching(false);
  }, [isOpen, editingAnnouncement, courses, isTeacherNotAdmin]);

  const existingCount = announcementId !== null ? existingAttachments.length : 0;
  const totalAttachments = existingCount + pendingAttachments.length + (selectedFile ? 1 : 0);
  const effectiveAllAudienceSelected = isTeacherNotAdmin ? false : allAudienceSelected;
  const effectiveStaffAudienceSelected = isTeacherNotAdmin ? true : staffAudienceSelected;
  const effectiveStudentAudienceSelected = isTeacherNotAdmin ? false : studentAudienceSelected;
  const effectiveCustomAudienceSelected = isTeacherNotAdmin ? false : customAudienceSelected;
  const effectiveStaffAudiences = isTeacherNotAdmin ? ['teachers' as const] : staffAudiences;
  const targetRoles = getAudienceTokens({
    allSelected: effectiveAllAudienceSelected,
    staffSelected: effectiveStaffAudienceSelected,
    studentSelected: effectiveStudentAudienceSelected,
    customSelected: effectiveCustomAudienceSelected,
    staffAudiences: effectiveStaffAudiences,
    studentAudiences,
    customUserIds,
  });
  const scheduledAtIso = deliveryMode === 'schedule' && scheduledAtLocal
    ? new Date(scheduledAtLocal).toISOString()
    : null;
  const announcementStatus: Announcement['status'] =
    deliveryMode === 'draft' ? 'draft' : deliveryMode === 'schedule' ? 'scheduled' : 'published';
  const deliveryLabel =
    deliveryMode === 'draft'
      ? 'Draft'
      : deliveryMode === 'schedule' && scheduledAtLocal
        ? formatPlatformDateTime(scheduledAtLocal)
        : isEditingPublished
          ? notifyAudience ? 'Published + email update' : 'Published'
          : 'Publish now';
  const recipientCount = useMemo(() => {
    return getRecipientIds({
      targetRoles,
      users,
      courses,
      courseStudents,
    }).size;
  }, [courseStudents, courses, targetRoles, users]);

  const filteredCustomUsers = useMemo(() => {
    const query = customSearch.trim().toLowerCase();
    if (!query) return users;
    return users.filter(user => {
      const roleText = user.roles.join(' ');
      return `${user.name} ${user.email} ${roleText}`.toLowerCase().includes(query);
    });
  }, [customSearch, users]);
  const customPageSize = 8;
  const customPageCount = Math.max(1, Math.ceil(filteredCustomUsers.length / customPageSize));
  const customPageItems = filteredCustomUsers.slice(
    customPage * customPageSize,
    customPage * customPageSize + customPageSize
  );
  const selectedCustomUsers = useMemo(() => {
    const byId = new Map(users.map(user => [user.id, user]));
    return customUserIds.map(id => byId.get(id)).filter((user): user is User => Boolean(user));
  }, [customUserIds, users]);

  if (!isOpen) return null;

  const chooseFile = (file: File | null) => {
    setSelectedFile(file);
    setFileTitle(file ? file.name.replace(/\.[^/.]+$/, '') : '');
    setErrors(prev => ({ ...prev, file: undefined }));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    chooseFile(e.target.files?.[0] ?? null);
    e.target.value = '';
  };

  const handleAddSelectedFile = async () => {
    if (!selectedFile) {
      setErrors(prev => ({ ...prev, file: 'Choose a file first' }));
      return;
    }

    const cleanTitle = fileTitle.trim() || selectedFile.name;
    if (announcementId !== null) {
      setAttaching(true);
      try {
        await onAddAttachment(announcementId, {
          file: selectedFile,
          attachmentType: 'file',
          linkTitle: cleanTitle,
        });
        chooseFile(null);
      } finally {
        setAttaching(false);
      }
      return;
    }

    setPendingAttachments(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        file: selectedFile,
        attachmentType: 'file',
        linkTitle: cleanTitle,
      },
    ]);
    chooseFile(null);
  };

  const handleAddLink = async () => {
    if (!linkUrl.includes('docs.google.com')) {
      setErrors(prev => ({ ...prev, link: 'Please paste a valid Google Docs link' }));
      return;
    }

    const attachment = {
      attachmentType: linkType,
      linkUrl: linkUrl.trim(),
      linkTitle: linkTitle.trim() || undefined,
    };

    setErrors(prev => ({ ...prev, link: undefined }));
    if (announcementId !== null) {
      setAttaching(true);
      try {
        await onAddAttachment(announcementId, attachment);
      } finally {
        setAttaching(false);
      }
    } else {
      setPendingAttachments(prev => [...prev, { id: crypto.randomUUID(), ...attachment }]);
    }
    setLinkUrl('');
    setLinkTitle('');
    setLinkFormOpen(false);
  };

  const removePending = (id: string) => {
    setPendingAttachments(prev => prev.filter(p => p.id !== id));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const newErrors: { title?: string; content?: string; course?: string; schedule?: string; language?: string } = {};
    const hasEnglishTitle = title.trim().length > 0;
    const hasEnglishContent = content.trim().length > 0;
    const hasBulgarianTitle = titleBg.trim().length > 0;
    const hasBulgarianContent = contentBg.trim().length > 0;
    const englishComplete = hasEnglishTitle && hasEnglishContent;
    const bulgarianComplete = hasBulgarianTitle && hasBulgarianContent;

    if (!englishComplete && !bulgarianComplete) {
      newErrors.language = 'Add a title and body in English, Bulgarian, or both.';
    } else {
      if ((hasEnglishTitle || hasEnglishContent) && !englishComplete) {
        newErrors.language = 'English needs both a title and body, or leave both English fields empty.';
      }
      if ((hasBulgarianTitle || hasBulgarianContent) && !bulgarianComplete) {
        newErrors.language = 'Bulgarian needs both a title and body, or leave both Bulgarian fields empty.';
      }
    }
    if (
      !effectiveAllAudienceSelected &&
      !effectiveStaffAudienceSelected &&
      !effectiveStudentAudienceSelected &&
      !effectiveCustomAudienceSelected
    ) {
      newErrors.course = 'Choose at least one audience';
    } else if (effectiveStaffAudienceSelected && effectiveStaffAudiences.length === 0) {
      newErrors.course = 'Choose at least one staff audience';
    } else if (effectiveStudentAudienceSelected && studentAudiences.length === 0) {
      newErrors.course = 'Choose at least one student audience';
    } else if (effectiveCustomAudienceSelected && customUserIds.length === 0) {
      newErrors.course = 'Select at least one recipient';
    }
    if (deliveryMode === 'schedule') {
      if (!scheduledAtLocal) {
        newErrors.schedule = 'Choose a schedule date and time';
      } else if (new Date(scheduledAtLocal).getTime() <= Date.now()) {
        newErrors.schedule = 'Choose a future date and time';
      }
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
        titleBg: titleBg.trim() || null,
        contentBg: contentBg.trim() || null,
        type: 'post',
        courseId: null,
        targetRoles,
        isPinned,
        isStaffOnly:
          effectiveStaffAudienceSelected &&
          !effectiveAllAudienceSelected &&
          !effectiveStudentAudienceSelected &&
          !effectiveCustomAudienceSelected,
        status: announcementStatus,
        scheduledAt: scheduledAtIso,
        notifyAudience: isEditingPublished && notifyAudience,
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
    } finally {
      setSubmitting(false);
    }
  };

  const audienceOptions: Array<{
    id: AudienceGroup;
    label: string;
    description: string;
    icon: typeof Globe2;
    selected: boolean;
    disabled: boolean;
  }> = [
    {
      id: 'all',
      label: 'All',
      description: 'Everyone',
      icon: Globe2,
      selected: effectiveAllAudienceSelected,
      disabled: isTeacherNotAdmin,
    },
    {
      id: 'staff',
      label: 'Staff',
      description: effectiveStaffAudienceSelected ? `${effectiveStaffAudiences.length} selected` : 'Staff groups',
      icon: Users,
      selected: effectiveStaffAudienceSelected,
      disabled: isTeacherNotAdmin,
    },
    {
      id: 'students',
      label: 'Students',
      description: effectiveStudentAudienceSelected ? `${studentAudiences.length} selected` : 'Year groups',
      icon: Users,
      selected: effectiveStudentAudienceSelected,
      disabled: isTeacherNotAdmin,
    },
    {
      id: 'custom',
      label: 'Custom',
      description: `${customUserIds.length} selected`,
      icon: Search,
      selected: effectiveCustomAudienceSelected,
      disabled: isTeacherNotAdmin,
    },
  ];
  const staffSubOptions: Array<{ id: AudienceSubChoice; label: string; description: string }> = [
    { id: 'staff', label: 'All staff', description: 'Admins, mentors, teachers, team leaders' },
    { id: 'teachers', label: 'Teachers', description: 'Teacher role only' },
    { id: 'translators', label: 'Translators', description: 'Translator role only' },
  ];
  const studentSubOptions: Array<{ id: AudienceSubChoice; label: string; description: string }> = [
    { id: 'first_year_students', label: 'First Year', description: 'Active first-year students' },
    { id: 'second_year_students', label: 'Second Year', description: 'Active second-year students' },
  ];
  const deliveryOptions = [
    {
      id: 'now' as const,
      label: isEditingPublished ? 'Published' : 'Publish now',
      description: isEditingPublished
        ? 'Save changes without sending a new email.'
        : 'Visible immediately and queued for email notification.',
      icon: Clock,
      theme: {
        selected: 'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534] shadow-[0_0_0_1px_rgba(22,101,52,0.08)]',
        idle: 'border-[#dcfce7] bg-white hover:border-[#bbf7d0] hover:bg-[#f0fdf4]',
        icon: 'bg-[#dcfce7] text-[#16a34a] ring-[#bbf7d0]',
        check: 'text-[#16a34a]',
      },
    },
    {
      id: 'schedule' as const,
      label: 'Schedule',
      description: 'Publish and email at a future time.',
      icon: CalendarClock,
      theme: {
        selected: 'border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8] shadow-[0_0_0_1px_rgba(29,78,216,0.08)]',
        idle: 'border-[#dbeafe] bg-white hover:border-[#bfdbfe] hover:bg-[#eff6ff]',
        icon: 'bg-[#dbeafe] text-[#2563eb] ring-[#bfdbfe]',
        check: 'text-[#2563eb]',
      },
    },
    {
      id: 'draft' as const,
      label: 'Draft',
      description: 'Save privately without sending notifications.',
      icon: FileText,
      theme: {
        selected: 'border-[#ddd6fe] bg-[#f5f3ff] text-[#6d28d9] shadow-[0_0_0_1px_rgba(109,40,217,0.08)]',
        idle: 'border-[#ede9fe] bg-white hover:border-[#ddd6fe] hover:bg-[#f5f3ff]',
        icon: 'bg-[#ede9fe] text-[#7c3aed] ring-[#ddd6fe]',
        check: 'text-[#7c3aed]',
      },
    },
  ];

  const selectAudienceGroup = (group: AudienceGroup) => {
    if (isTeacherNotAdmin) return;

    if (group === 'all') {
      setAllAudienceSelected(true);
      setStaffAudienceSelected(false);
      setStudentAudienceSelected(false);
      setCustomAudienceSelected(false);
      setCustomPickerOpen(false);
      return;
    }

    setAllAudienceSelected(false);

    if (group === 'staff') {
      setStaffAudienceSelected(prev => {
        const next = !prev;
        if (next && staffAudiences.length === 0) setStaffAudiences(DEFAULT_STAFF_AUDIENCES);
        return next;
      });
      return;
    }

    if (group === 'students') {
      setStudentAudienceSelected(prev => {
        const next = !prev;
        if (next && studentAudiences.length === 0) setStudentAudiences(DEFAULT_STUDENT_AUDIENCES);
        return next;
      });
      return;
    }

    setCustomAudienceSelected(prev => {
      const next = !prev;
      if (next) setCustomPickerOpen(true);
      return next;
    });
  };

  const toggleSubAudience = (
    id: AudienceSubChoice,
    setter: Dispatch<SetStateAction<AudienceSubChoice[]>>
  ) => {
    setter(prev =>
      prev.includes(id)
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  const selectStaffAudience = (id: AudienceSubChoice) => {
    setStaffAudiences(prev => (prev.includes(id) ? [] : [id]));
  };

  return (
    <>
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button
            type="button"
            onClick={onClose}
            className="tbo-focus mb-3 inline-flex items-center gap-2 rounded-lg border border-[#e5e5e5] bg-white px-3 py-1.5 text-sm font-medium text-[#525252] hover:bg-[#f5f5f5] hover:text-[#171717]"
          >
            <ArrowLeft className="h-4 w-4" />
            Stream
          </button>
          <h2 className="tbo-display text-2xl leading-tight text-[#171717] sm:text-3xl">
            {isEditing ? 'Edit post' : 'New post'}
          </h2>
        </div>
        <div className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-[#737373] ring-1 ring-[#e5e5e5]">
          {totalAttachments} attachment{totalAttachments === 1 ? '' : 's'}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <section className="tbo-panel p-5">
            <div className="space-y-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-[#171717]">Content languages</h3>
                  <p className="mt-0.5 text-xs text-[#737373]">English and Bulgarian are optional, but one complete language is required.</p>
                </div>
                <span className="w-fit rounded-full bg-[#f5f5f5] px-2.5 py-1 text-[11px] font-semibold text-[#737373] ring-1 ring-[#e5e5e5]">
                  EN / BG
                </span>
              </div>
              {errors.language && (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{errors.language}</p>
              )}
              <div className="inline-grid rounded-full border border-[#e5e5e5] bg-white p-1 sm:grid-cols-2">
                {([
                  {
                    id: 'en',
                    label: 'English',
                    meta: 'Default',
                    complete: title.trim().length > 0 && content.trim().length > 0,
                  },
                  {
                    id: 'bg',
                    label: 'Bulgarian',
                    meta: 'Optional',
                    complete: titleBg.trim().length > 0 && contentBg.trim().length > 0,
                  },
                ] as const).map(option => {
                  const selected = contentLanguage === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setContentLanguage(option.id)}
                      className={`tbo-focus flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                        selected
                          ? 'bg-[#171717] text-white'
                          : 'text-[#737373] hover:bg-[#f5f5f5] hover:text-[#171717]'
                      }`}
                    >
                      <span>{option.label}</span>
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                        selected ? 'bg-white/15 text-white' : 'bg-[#f5f5f5] text-[#737373]'
                      }`}>
                        {option.meta}
                      </span>
                      {option.complete && (
                        <span className={`h-1.5 w-1.5 rounded-full ${selected ? 'bg-[#86efac]' : 'bg-[#16a34a]'}`} />
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="space-y-4">
                <div className={`${contentLanguage === 'en' ? 'block' : 'hidden'} rounded-2xl border border-[#e5e5e5] bg-white p-4`}>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-[#171717]">English</span>
                    <span className="rounded-full bg-[#eff6ff] px-2 py-0.5 text-[11px] font-semibold text-[#1d4ed8]">Default</span>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="announcement-title" className="mb-1 block text-sm font-medium text-[#525252]">
                        Title
                      </label>
                      <input
                        id="announcement-title"
                        type="text"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        className="tbo-focus w-full rounded-lg border border-[#d4d4d4] px-3 py-2 text-sm"
                        placeholder="Post title"
                      />
                    </div>

                    <div>
                      <label htmlFor="announcement-content" className="mb-1 block text-sm font-medium text-[#525252]">
                        Body
                      </label>
                      <textarea
                        id="announcement-content"
                        value={content}
                        onChange={e => setContent(e.target.value)}
                        rows={8}
                        className="tbo-focus w-full resize-none rounded-lg border border-[#d4d4d4] px-3 py-2 text-sm"
                        placeholder="Write your post..."
                      />
                    </div>
                  </div>
                </div>

                <div className={`${contentLanguage === 'bg' ? 'block' : 'hidden'} rounded-2xl border border-[#e5e5e5] bg-white p-4`}>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-[#171717]">Bulgarian</span>
                    <span className="rounded-full bg-[#f5f5f5] px-2 py-0.5 text-[11px] font-semibold text-[#737373] ring-1 ring-[#e5e5e5]">Optional</span>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="announcement-title-bg-clean" className="mb-1 block text-sm font-medium text-[#525252]">
                        Bulgarian title
                      </label>
                      <input
                        id="announcement-title-bg-clean"
                        type="text"
                        value={titleBg}
                        onChange={e => setTitleBg(e.target.value)}
                        className="tbo-focus w-full rounded-lg border border-[#d4d4d4] px-3 py-2 text-sm"
                        placeholder="Post title in Bulgarian"
                      />
                    </div>

                    <div>
                      <label htmlFor="announcement-content-bg-clean" className="mb-1 block text-sm font-medium text-[#525252]">
                        Bulgarian body
                      </label>
                      <textarea
                        id="announcement-content-bg-clean"
                        value={contentBg}
                        onChange={e => setContentBg(e.target.value)}
                        rows={8}
                        className="tbo-focus w-full resize-none rounded-lg border border-[#d4d4d4] px-3 py-2 text-sm"
                        placeholder="Write your post in Bulgarian..."
                      />
                    </div>
                  </div>
                </div>

                <div className="hidden">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-[#171717]">Bulgarian</span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-[#737373] ring-1 ring-[#e5e5e5]">Optional</span>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="announcement-title-bg" className="mb-1 block text-sm font-medium text-[#525252]">
                        Заглавие
                      </label>
                      <input
                        id="announcement-title-bg"
                        type="text"
                        value={titleBg}
                        onChange={e => setTitleBg(e.target.value)}
                        className="tbo-focus w-full rounded-lg border border-[#d4d4d4] bg-white px-3 py-2 text-sm"
                        placeholder="Заглавие на съобщението"
                      />
                    </div>

                    <div>
                      <label htmlFor="announcement-content-bg" className="mb-1 block text-sm font-medium text-[#525252]">
                        Текст
                      </label>
                      <textarea
                        id="announcement-content-bg"
                        value={contentBg}
                        onChange={e => setContentBg(e.target.value)}
                        rows={8}
                        className="tbo-focus w-full resize-none rounded-lg border border-[#d4d4d4] bg-white px-3 py-2 text-sm"
                        placeholder="Напишете съобщението..."
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="tbo-panel p-5">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-[#171717]">Delivery</h3>
              <p className="mt-0.5 text-xs text-[#737373]">
                {isEditingPublished
                  ? 'This post is already published. Saving changes updates it without notifying recipients again.'
                  : 'Choose whether this is published now, scheduled, or saved as a draft.'}
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {deliveryOptions.map(option => {
                const Icon = option.icon;
                const selected = deliveryMode === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setDeliveryMode(option.id)}
                    className={`tbo-focus rounded-xl border p-4 text-left transition ${
                      selected ? option.theme.selected : option.theme.idle
                    }`}
                  >
                    <span className="mb-3 flex items-center justify-between gap-3">
                      <span className={`grid h-9 w-9 place-items-center rounded-lg ring-1 ${option.theme.icon}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      {selected && <CheckCircle2 className={`h-4 w-4 ${option.theme.check}`} />}
                    </span>
                    <span className="block text-sm font-semibold text-[#171717]">{option.label}</span>
                    <span className="mt-1 block text-xs leading-5 text-[#737373]">{option.description}</span>
                  </button>
                );
              })}
            </div>

            {deliveryMode === 'schedule' && (
              <div className="mt-4">
                <label htmlFor="announcement-schedule" className="mb-1 block text-sm font-medium text-[#525252]">
                  Scheduled date and time
                </label>
                <input
                  id="announcement-schedule"
                  type="datetime-local"
                  value={scheduledAtLocal}
                  onChange={e => setScheduledAtLocal(e.target.value)}
                  className="tbo-focus w-full rounded-lg border border-[#d4d4d4] px-3 py-2 text-sm"
                />
                {errors.schedule && <p className="mt-1 text-sm text-red-500">{errors.schedule}</p>}
              </div>
            )}

          </section>

          <section className="tbo-panel p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[#171717]">Audience</h3>
                <p className="mt-0.5 text-xs text-[#737373]">Choose who should see this post.</p>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {audienceOptions.map(option => {
                const Icon = option.icon;
                const selected = option.selected;
                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={option.disabled}
                    onClick={() => selectAudienceGroup(option.id)}
                    className={`tbo-focus rounded-xl border p-3 text-left transition ${
                      selected
                        ? 'border-[#2563eb] bg-[#dbeaff] shadow-[0_0_0_1px_rgba(37,99,235,0.12)]'
                        : 'border-[#e5e5e5] bg-white hover:border-[#d4d4d4] hover:bg-[#fafafa]'
                    } ${option.disabled ? 'cursor-not-allowed opacity-45' : ''}`}
                  >
                    <span className="mb-2 flex items-center justify-between gap-2">
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-white text-[#171717] ring-1 ring-[#e5e5e5]">
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      {selected && <CheckCircle2 className="h-4 w-4 text-[#2563eb]" />}
                    </span>
                    <span className="block text-xs font-semibold leading-4 text-[#171717]">{option.label}</span>
                    <span className="mt-1 block text-[11px] leading-4 text-[#737373]">{option.description}</span>
                  </button>
                );
              })}
            </div>

            {(effectiveStaffAudienceSelected || effectiveStudentAudienceSelected || effectiveCustomAudienceSelected) && (
              <div className="mt-3 space-y-3 rounded-xl border border-[#e5e5e5] bg-[#fafafa] p-3">
                {effectiveStaffAudienceSelected && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#737373]">Staff</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {staffSubOptions.map(option => {
                        const selected = effectiveStaffAudiences.includes(option.id);
                        return (
                          <button
                            key={option.id}
                            type="button"
                            disabled={isTeacherNotAdmin}
                            onClick={() => selectStaffAudience(option.id)}
                            className={`tbo-focus rounded-lg border px-3 py-2 text-left transition ${
                              selected
                                ? 'border-[#2563eb] bg-white text-[#171717] shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
                                : 'border-[#e5e5e5] bg-white/70 text-[#737373] hover:border-[#d4d4d4] hover:bg-white'
                            } ${isTeacherNotAdmin ? 'cursor-not-allowed opacity-60' : ''}`}
                          >
                            <span className="flex items-center justify-between gap-2">
                              <span className="text-sm font-semibold">{option.label}</span>
                              {selected && <CheckCircle2 className="h-4 w-4 text-[#2563eb]" />}
                            </span>
                            <span className="mt-0.5 block text-xs leading-5 text-[#737373]">{option.description}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {effectiveStudentAudienceSelected && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#737373]">Students</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {studentSubOptions.map(option => {
                        const selected = studentAudiences.includes(option.id);
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => toggleSubAudience(option.id, setStudentAudiences)}
                            className={`tbo-focus rounded-lg border px-3 py-2 text-left transition ${
                              selected
                                ? 'border-[#2563eb] bg-white text-[#171717] shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
                                : 'border-[#e5e5e5] bg-white/70 text-[#737373] hover:border-[#d4d4d4] hover:bg-white'
                            }`}
                          >
                            <span className="flex items-center justify-between gap-2">
                              <span className="text-sm font-semibold">{option.label}</span>
                              {selected && <CheckCircle2 className="h-4 w-4 text-[#2563eb]" />}
                            </span>
                            <span className="mt-0.5 block text-xs leading-5 text-[#737373]">{option.description}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {effectiveCustomAudienceSelected && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#e5e5e5] bg-white px-3 py-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <UserAvatarStack users={selectedCustomUsers} max={5} />
                      <span className="text-xs font-medium text-[#525252]">
                        <span className="font-semibold text-[#171717]">{customUserIds.length}</span> custom recipient{customUserIds.length === 1 ? '' : 's'}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setCustomPickerOpen(true)}
                      className="tbo-focus rounded-lg bg-[#f5f5f5] px-2.5 py-1 text-xs font-medium text-[#171717] ring-1 ring-[#e5e5e5] hover:bg-white"
                    >
                      Edit recipients
                    </button>
                  </div>
                )}
              </div>
            )}
            {errors.course && <p className="mt-2 text-sm text-red-500">{errors.course}</p>}
          </section>

          <section className="tbo-panel p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[#171717]">Attachments</h3>
                <p className="mt-0.5 text-xs text-[#737373]">Give every attachment a readable title.</p>
              </div>
              {attaching && <span className="text-xs font-medium text-[#737373]">Attaching...</span>}
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-dashed border-[#d4d4d4] bg-[#fafafa] p-4">
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
                  className="tbo-focus flex w-full items-center gap-3 rounded-lg bg-white p-3 text-left ring-1 ring-[#e5e5e5] hover:bg-[#f5f5f5]"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#f5f5f5] text-[#525252]">
                    <Upload className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-[#171717]">Choose file</span>
                    <span className="text-xs text-[#737373]">PDF, image, doc, or handout</span>
                  </span>
                </button>
                {selectedFile && (
                  <div className="mt-3 space-y-2">
                    <p className="truncate text-xs text-[#737373]">{selectedFile.name}</p>
                    <input
                      type="text"
                      value={fileTitle}
                      onChange={e => setFileTitle(e.target.value)}
                      placeholder="Attachment title"
                      className="tbo-focus w-full rounded-lg border border-[#d4d4d4] bg-white px-3 py-2 text-sm"
                    />
                    {errors.file && <p className="text-sm text-red-500">{errors.file}</p>}
                    <button
                      type="button"
                      onClick={handleAddSelectedFile}
                      disabled={attaching}
                      className="tbo-focus w-full rounded-lg bg-[#171717] px-3 py-2 text-sm font-medium text-white hover:bg-[#404040] disabled:opacity-50"
                    >
                      Add file
                    </button>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-[#e5e5e5] bg-[#fafafa] p-4">
                <button
                  type="button"
                  onClick={() => setLinkFormOpen(prev => !prev)}
                  className="tbo-focus flex w-full items-center gap-3 rounded-lg bg-white p-3 text-left ring-1 ring-[#e5e5e5] hover:bg-[#f5f5f5]"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#f5f5f5] text-[#525252]">
                    <Link className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-[#171717]">Google link</span>
                    <span className="text-xs text-[#737373]">Docs, Sheets, or Slides</span>
                  </span>
                </button>
                {linkFormOpen && (
                  <div className="mt-3 space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { type: 'google_doc' as const, label: 'Doc', icon: FileText },
                        { type: 'google_sheet' as const, label: 'Sheet', icon: Table },
                        { type: 'google_slide' as const, label: 'Slide', icon: Presentation },
                      ].map(({ type, label, icon: Icon }) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setLinkType(type)}
                          className={`tbo-focus flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium ${
                            linkType === type
                              ? 'border-[#2563eb] bg-[#dbeaff] text-[#171717]'
                              : 'border-[#d4d4d4] bg-white text-[#525252] hover:bg-[#f5f5f5]'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {label}
                        </button>
                      ))}
                    </div>
                    <input
                      type="url"
                      value={linkUrl}
                      onChange={e => setLinkUrl(e.target.value)}
                      placeholder="Paste Google link"
                      className="tbo-focus w-full rounded-lg border border-[#d4d4d4] bg-white px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      value={linkTitle}
                      onChange={e => setLinkTitle(e.target.value)}
                      placeholder="Attachment title"
                      className="tbo-focus w-full rounded-lg border border-[#d4d4d4] bg-white px-3 py-2 text-sm"
                    />
                    {errors.link && <p className="text-sm text-red-500">{errors.link}</p>}
                    <button
                      type="button"
                      onClick={handleAddLink}
                      disabled={!linkUrl.trim() || attaching}
                      className="tbo-focus w-full rounded-lg bg-[#171717] px-3 py-2 text-sm font-medium text-white hover:bg-[#404040] disabled:opacity-50"
                    >
                      Add link
                    </button>
                  </div>
                )}
              </div>
            </div>

            {(existingAttachments.length > 0 || pendingAttachments.length > 0) && (
              <div className="mt-4 grid gap-2">
                {existingAttachments.map(attachment => {
                  const url = getAttachmentUrl(attachment);
                  const tone = getAttachmentTone(attachment.attachmentType, attachment.mimeType);
                  return (
                    <div key={attachment.id} className="grid grid-cols-[36px_1fr_auto] items-center gap-2 rounded-lg border border-[#e5e5e5] bg-white px-3 py-2 text-sm">
                      <span className={`grid h-9 w-9 place-items-center rounded-lg ring-1 ${tone}`}>
                        <AttachmentTypeIcon type={attachment.attachmentType} mimeType={attachment.mimeType} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-[#171717]">{getAttachmentLabel(attachment)}</span>
                        <span className="block text-xs text-[#737373]">{getAttachmentTypeLabel(attachment.attachmentType, undefined, attachment.mimeType)}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        {url && canPreviewInApp(attachment) && (
                          <button
                            type="button"
                            onClick={() => {
                              const preview = resolveAnnouncementPreview(attachment);
                              if (preview) setPreviewItem(preview);
                            }}
                            className="rounded-md p-1.5 text-[#737373] hover:bg-[#f5f5f5] hover:text-[#171717]"
                            aria-label="Preview attachment"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {url && (
                          <a href={url} target="_blank" rel="noopener noreferrer" className="rounded-md p-1.5 text-[#737373] hover:bg-[#f5f5f5] hover:text-[#171717]" aria-label="Open attachment in new tab">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                        <button type="button" onClick={() => onDeleteAttachment(attachment.id, attachment.storagePath)} className="rounded-md p-1.5 text-[#a3a3a3] hover:bg-[#fef2f2] hover:text-red-600" aria-label="Remove attachment">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    </div>
                  );
                })}
                {pendingAttachments.map(pending => {
                  const tone = getAttachmentTone(pending.attachmentType, pending.file?.type);
                  return (
                    <div key={pending.id} className="grid grid-cols-[36px_1fr_auto] items-center gap-2 rounded-lg border border-[#e5e5e5] bg-white px-3 py-2 text-sm">
                      <span className={`grid h-9 w-9 place-items-center rounded-lg ring-1 ${tone}`}>
                        <AttachmentTypeIcon type={pending.attachmentType} mimeType={pending.file?.type} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-[#171717]">{getAttachmentLabel(pending)}</span>
                        <span className="block text-xs text-[#737373]">{getAttachmentTypeLabel(pending.attachmentType, pending.file)}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        {pending.file && canPreviewLocalFile(pending.file) && (
                          <button
                            type="button"
                            onClick={() => {
                              if (!pending.file) return;
                              const preview = resolveLocalFilePreview(pending.file, getAttachmentLabel(pending));
                              if (preview) setPreviewItem(preview);
                            }}
                            className="rounded-md p-1.5 text-[#737373] hover:bg-[#f5f5f5] hover:text-[#171717]"
                            aria-label="Preview attachment"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button type="button" onClick={() => removePending(pending.id)} className="rounded-md p-1.5 text-[#a3a3a3] hover:bg-[#fef2f2] hover:text-red-600" aria-label="Remove pending attachment">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-5">
          <section className="tbo-panel p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-2">
                <Pin className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#d97706]" />
                <div>
                  <p className="text-sm font-semibold text-[#171717]">Pin this post</p>
                  <p className="mt-0.5 text-xs leading-5 text-[#737373]">
                    Pinned posts appear at the top of the stream.
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isPinned}
                onClick={() => setIsPinned(prev => !prev)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                  isPinned ? 'bg-[#171717]' : 'bg-[#d4d4d4]'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isPinned ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </section>

          <section className="tbo-panel p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[#171717]">Summary</p>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#dbeaff] px-2.5 py-1 text-xs font-semibold text-[#171717]">
                <Users className="h-3.5 w-3.5 text-[#2563eb]" />
                {recipientCount}
              </span>
            </div>
            <div className="mt-4 rounded-xl border border-[#e5e5e5] bg-[#fafafa] p-3">
              <p className="text-xs font-medium text-[#737373]">Recipients</p>
              <p className="mt-1 text-2xl font-semibold tracking-[-0.02em] text-[#171717]">
                {recipientCount}
              </p>
              <p className="mt-1 text-xs leading-5 text-[#737373]">
                Estimated from current people, roles, and active year group enrollments.
              </p>
            </div>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-[#737373]">Audience</dt>
                <dd className="max-w-[190px] text-right font-medium text-[#171717]">{getAudienceSummaryLabel(targetRoles)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#737373]">Delivery</dt>
                <dd className="max-w-[180px] text-right font-medium text-[#171717]">{deliveryLabel}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#737373]">Attachments</dt>
                <dd className="font-medium text-[#171717]">{totalAttachments}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#737373]">Pinned</dt>
                <dd className="font-medium text-[#171717]">{isPinned ? 'Yes' : 'No'}</dd>
              </div>
            </dl>
          </section>

          {isEditingPublished && (
            <button
              type="button"
              role="switch"
              aria-checked={notifyAudience}
              onClick={() => setNotifyAudience(prev => !prev)}
              className={`tbo-focus w-full rounded-xl border p-3 text-left transition ${
                notifyAudience
                  ? 'border-[#2563eb] bg-[#eff6ff] shadow-[0_0_0_1px_rgba(37,99,235,0.10)]'
                  : 'border-[#e5e5e5] bg-white hover:border-[#d4d4d4] hover:bg-[#fafafa]'
              }`}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-3">
                  <span className={`grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl ring-1 ${
                    notifyAudience
                      ? 'bg-white text-[#2563eb] ring-blue-100'
                      : 'bg-[#f5f5f5] text-[#737373] ring-[#e5e5e5]'
                  }`}>
                    <Users className="h-4.5 w-4.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-[#171717]">
                      Notify audience
                    </span>
                    <span className="mt-0.5 block text-xs leading-5 text-[#737373]">
                      Send an email update to {recipientCount} recipient{recipientCount === 1 ? '' : 's'}.
                    </span>
                  </span>
                </span>
                <span className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors ${
                  notifyAudience ? 'bg-[#2563eb]' : 'bg-[#d4d4d4]'
                }`}>
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                    notifyAudience ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </span>
              </span>
              <span className={`mt-3 block rounded-lg px-3 py-2 text-xs font-medium ${
                notifyAudience
                  ? 'bg-white text-[#2563eb] ring-1 ring-blue-100'
                  : 'bg-[#fafafa] text-[#737373] ring-1 ring-[#e5e5e5]'
              }`}>
                {notifyAudience
                  ? 'This edit will be emailed after you save.'
                  : 'Quiet save is on. No email will be sent for this edit.'}
              </span>
            </button>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="tbo-focus flex-1 rounded-lg border border-[#d4d4d4] bg-white px-4 py-2 text-sm font-medium text-[#525252] hover:bg-[#f5f5f5]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || attaching}
              className="tbo-focus flex-1 rounded-lg bg-[#171717] px-4 py-2 text-sm font-medium text-white hover:bg-[#404040] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting
                ? 'Saving...'
                : deliveryMode === 'draft'
                  ? 'Save draft'
                  : deliveryMode === 'schedule'
                    ? isEditing ? 'Save schedule' : 'Schedule'
                    : isEditing ? 'Save changes' : 'Post'}
            </button>
          </div>
        </aside>
      </form>

      {customPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-0 sm:items-center sm:p-4">
          <div className="max-h-[88vh] w-full max-w-3xl overflow-hidden rounded-t-2xl border border-[#e5e5e5] bg-white shadow-xl sm:rounded-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-[#f5f5f5] px-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-[#171717]">Custom recipients</h3>
                <p className="mt-1 text-sm text-[#737373]">
                  Select one or more people. Each person is counted once, even with multiple roles.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCustomPickerOpen(false)}
                className="tbo-focus rounded-lg p-1.5 text-[#737373] hover:bg-[#f5f5f5] hover:text-[#171717]"
                aria-label="Close custom recipients"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="border-b border-[#f5f5f5] px-5 py-3">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a3a3a3]" />
                <input
                  type="search"
                  value={customSearch}
                  onChange={e => {
                    setCustomSearch(e.target.value);
                    setCustomPage(0);
                  }}
                  placeholder="Search by name, email, or role"
                  className="tbo-focus w-full rounded-xl border border-[#d4d4d4] bg-white py-2 pl-9 pr-3 text-sm"
                />
              </label>
            </div>

            <div className="max-h-[52vh] overflow-y-auto px-5 py-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {customPageItems.map(user => {
                  const selected = customUserIds.includes(user.id);
                  const realRoles = getRealRoles(user);
                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() =>
                        setCustomUserIds(prev =>
                          selected ? prev.filter(id => id !== user.id) : [...prev, user.id]
                        )
                      }
                      className={`tbo-focus rounded-xl border p-3 text-left transition ${
                        selected
                          ? 'border-[#2563eb] bg-[#dbeaff]'
                          : 'border-[#e5e5e5] bg-white hover:border-[#d4d4d4] hover:bg-[#fafafa]'
                      }`}
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span className="flex min-w-0 items-start gap-3">
                          <UserAvatar user={user} />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-[#171717]">{user.name}</span>
                            <span className="block truncate text-xs text-[#737373]">{user.email}</span>
                          </span>
                        </span>
                        {selected && <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-[#2563eb]" />}
                      </span>
                      <span className="mt-2 flex flex-wrap gap-1">
                        {realRoles.length === 0 ? (
                          <span className="rounded-full bg-[#f5f5f5] px-2 py-0.5 text-[11px] font-medium text-[#737373]">
                            No role
                          </span>
                        ) : (
                          realRoles.map(role => (
                            <span
                              key={role}
                              className="rounded-full bg-[#f5f5f5] px-2 py-0.5 text-[11px] font-medium text-[#525252]"
                            >
                              {formatRoleLabel(role)}
                            </span>
                          ))
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>

              {filteredCustomUsers.length === 0 && (
                <div className="rounded-xl border border-dashed border-[#d4d4d4] px-4 py-8 text-center text-sm text-[#737373]">
                  No people match your search.
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 border-t border-[#f5f5f5] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3 text-sm text-[#737373]">
                <UserAvatarStack users={selectedCustomUsers} max={6} />
                <span>
                  <span className="font-semibold text-[#171717]">{customUserIds.length}</span> selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCustomPage(page => Math.max(0, page - 1))}
                  disabled={customPage === 0}
                  className="tbo-focus rounded-lg border border-[#d4d4d4] bg-white px-3 py-1.5 text-sm font-medium text-[#525252] hover:bg-[#f5f5f5] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-xs font-medium text-[#737373]">
                  Page {customPage + 1} of {customPageCount}
                </span>
                <button
                  type="button"
                  onClick={() => setCustomPage(page => Math.min(customPageCount - 1, page + 1))}
                  disabled={customPage >= customPageCount - 1}
                  className="tbo-focus rounded-lg border border-[#d4d4d4] bg-white px-3 py-1.5 text-sm font-medium text-[#525252] hover:bg-[#f5f5f5] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
                <button
                  type="button"
                  onClick={() => setCustomPickerOpen(false)}
                  className="tbo-focus rounded-lg bg-[#171717] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#404040]"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    <FilePreviewModal item={previewItem} onClose={() => setPreviewItem(null)} />
    </>
  );
}
