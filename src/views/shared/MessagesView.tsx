import { useState, useRef, useEffect, useMemo } from 'react';
import {
  MessageSquare,
  Send,
  Plus,
  Search,
  X,
  ArrowLeft,
  Trash2,
  Users,
  GraduationCap,
  UserCheck,
  ShieldCheck,
} from 'lucide-react';
import type { Conversation, Course, CourseStudent, Message, User } from '../../types/lms';
import { hasRole } from '../../utils/userUtils';
import { formatTime } from '../../i18n/formatters';
import { useLanguage } from '../../i18n/LanguageContext';
import { translate } from '../../i18n/translate';
import { formatPlatformDate } from '../../utils/dateUtils';
import { PageHeader } from '../../components/ui/PageHeader';

interface MessagesViewProps {
  conversations: Conversation[];
  currentUser: User;
  users: User[];
  courses: Course[];
  courseStudents: CourseStudent[];
  loading: boolean;
  sending: boolean;
  error: string | null;
  onSend: (
    recipientIds: string | string[],
    content: string,
    audience?: { key: string; label: string }
  ) => Promise<void>;
  onMarkAsRead: (otherUserId: string) => Promise<void>;
  onDeleteMessage: (messageId: number) => Promise<void>;
}

function formatListTimestamp(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (minutes < 1) return translate('messages.time.justNow');
  if (minutes < 60) return translate('messages.time.minutesAgo', { count: minutes });
  if (hours < 24 && startOfDate.getTime() === startOfToday.getTime()) {
    return translate('messages.time.hoursAgo', { count: hours });
  }
  if (startOfDate.getTime() === startOfYesterday.getTime()) return translate('time.yesterday');
  if (diffMs < 7 * 86400000) return formatPlatformDate(dateString);
  return formatPlatformDate(dateString);
}

function formatBubbleTime(dateString: string): string {
  return formatTime(dateString, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatDateDivider(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (startOfDate.getTime() === startOfToday.getTime()) return translate('common.today');
  if (startOfDate.getTime() === startOfYesterday.getTime()) return translate('time.yesterday');
  const diffMs = startOfToday.getTime() - startOfDate.getTime();
  if (diffMs < 7 * 86400000) return formatPlatformDate(dateString);
  return formatPlatformDate(dateString);
}

function getDateKey(dateString: string): string {
  const d = new Date(dateString);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function groupMessagesByDate(messages: Message[]): { dateKey: string; label: string; messages: Message[] }[] {
  const groups: { dateKey: string; label: string; messages: Message[] }[] = [];
  for (const msg of messages) {
    const dateKey = getDateKey(msg.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.dateKey === dateKey) {
      last.messages.push(msg);
    } else {
      groups.push({
        dateKey,
        label: formatDateDivider(msg.createdAt),
        messages: [msg],
      });
    }
  }
  return groups;
}

function UserAvatar({
  user,
  size = 'md',
}: {
  user: { name: string; avatarUrl?: string | null };
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClass =
    size === 'sm' ? 'h-8 w-8 text-[10px]' :
    size === 'lg' ? 'h-10 w-10 text-sm' :
    'h-9 w-9 text-xs';

  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.name}
        className={`${sizeClass} shrink-0 rounded-full object-cover ring-1 ring-[#e5e5e5]`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} grid shrink-0 place-items-center rounded-full bg-[#f5f5f5] font-semibold text-[#525252] ring-1 ring-[#e5e5e5]`}
    >
      {user.name.charAt(0).toUpperCase()}
    </div>
  );
}

interface ConversationListItemProps {
  conversation: Conversation;
  otherUser: User | undefined;
  isSelected: boolean;
  onSelect: () => void;
}

function ConversationListItem({ conversation, otherUser, isSelected, onSelect }: ConversationListItemProps) {
  const hasUnread = conversation.unreadCount > 0;
  const isAudience = Boolean(conversation.audienceKey);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`tbo-focus flex w-full gap-3 border-b border-[#f0f0f0] px-4 py-3 text-left transition-colors ${
        isSelected ? 'bg-[#eff6ff]' : 'hover:bg-[#fafafa]'
      }`}
    >
      {isAudience ? (
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#dbeaff] text-[#2563eb] ring-1 ring-[#bfdbfe]">
          <Users className="h-4 w-4" />
        </div>
      ) : (
        <UserAvatar
          user={otherUser ?? { name: conversation.otherUserName }}
          size="lg"
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className={`truncate text-sm ${hasUnread ? 'font-semibold text-[#171717]' : 'font-medium text-[#171717]'}`}>
            {conversation.audienceLabel ?? conversation.otherUserName}
          </span>
          <span className="shrink-0 text-[11px] text-[#a3a3a3]">
            {formatListTimestamp(conversation.lastMessageAt)}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className={`truncate text-sm ${hasUnread ? 'font-medium text-[#525252]' : 'text-[#737373]'}`}>
            {conversation.lastMessage}
          </p>
          {hasUnread && (
            <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-[#171717] px-1.5 text-[11px] font-semibold text-white">
              {conversation.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

type AudienceOption = {
  key: string;
  label: string;
  helper: string;
  icon: typeof Users;
  recipientIds: string[];
};

interface MessageBubbleProps {
  message: Message;
  isMine: boolean;
  onDelete: (messageId: number) => void;
}

function MessageBubble({ message, isMine, onDelete }: MessageBubbleProps) {
  const { t } = useLanguage();

  return (
    <div className={`group flex ${isMine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`relative max-w-[75%] rounded-2xl px-3.5 py-2.5 ${
          isMine
            ? 'bg-[#171717] text-white'
            : 'border border-[#e5e5e5] bg-white text-[#171717]'
        }`}
      >
        <p className="whitespace-pre-wrap break-words text-sm leading-5">{message.content}</p>
        <div className={`mt-1.5 flex items-center gap-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
          <span className={`text-[11px] ${isMine ? 'text-white/60' : 'text-[#a3a3a3]'}`}>
            {formatBubbleTime(message.createdAt)}
          </span>
          {isMine && (
            <button
              type="button"
              onClick={() => onDelete(message.id)}
              className="rounded p-0.5 opacity-0 transition-opacity hover:bg-white/10 group-hover:opacity-100"
              aria-label={t('messages.delete')}
            >
              <Trash2 className="h-3.5 w-3.5 text-white/70" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface ComposeAreaProps {
  newMessage: string;
  sending: boolean;
  onChange: (value: string) => void;
  onSend: () => void;
}

function ComposeArea({ newMessage, sending, onChange, onSend }: ComposeAreaProps) {
  const { t } = useLanguage();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const lineHeight = 24;
    const maxHeight = lineHeight * 4;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  };

  useEffect(() => {
    adjustHeight();
  }, [newMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (newMessage.trim() && !sending) onSend();
    }
  };

  return (
    <div className="flex items-end gap-2 border-t border-[#e5e5e5] bg-white p-4">
      <textarea
        ref={textareaRef}
        value={newMessage}
        onChange={e => onChange(e.target.value)}
        onInput={adjustHeight}
        onKeyDown={handleKeyDown}
        placeholder={t('messages.compose.placeholder')}
        rows={1}
        className="tbo-focus max-h-24 flex-1 resize-none rounded-xl border border-[#d4d4d4] bg-[#fafafa] px-3 py-2.5 text-sm text-[#171717] placeholder:text-[#a3a3a3]"
      />
      <button
        type="button"
        onClick={onSend}
        disabled={!newMessage.trim() || sending}
        className="tbo-focus grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#171717] text-white hover:bg-[#404040] disabled:cursor-not-allowed disabled:opacity-40"
        aria-label={t('messages.send')}
      >
        <Send className="h-4 w-4" />
      </button>
    </div>
  );
}

export function MessagesView({
  conversations,
  currentUser,
  users,
  courses,
  courseStudents,
  loading,
  sending,
  error,
  onSend,
  onMarkAsRead,
  onDeleteMessage,
}: MessagesViewProps) {
  const { t, tCount, language } = useLanguage();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [composeMode, setComposeMode] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [composeSearchQuery, setComposeSearchQuery] = useState('');
  const [selectedAudienceKey, setSelectedAudienceKey] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const canStartConversations = hasRole(currentUser, 'administrator');
  const mobileShowThread = selectedUserId !== null || composeMode;
  const activeFirstYearCourseIds = new Set(courses.filter(course => course.status === 'active' && course.courseType === 'first_year').map(course => course.id));
  const activeSecondYearCourseIds = new Set(courses.filter(course => course.status === 'active' && course.courseType === 'second_year').map(course => course.id));
  const enrolledStudentIdsByCourse = useMemo(() => {
    const map = new Map<number, Set<string>>();
    courseStudents.forEach(enrollment => {
      if (enrollment.status !== 'active') return;
      const existing = map.get(enrollment.courseId) ?? new Set<string>();
      existing.add(enrollment.studentId);
      map.set(enrollment.courseId, existing);
    });
    return map;
  }, [courseStudents]);

  const audienceOptions = useMemo<AudienceOption[]>(() => {
    if (!canStartConversations) return [];
    const otherUsers = users.filter(user => user.id !== currentUser.id);
    const students = otherUsers.filter(user => user.roles.includes('student'));
    const firstYearStudents = students.filter(user =>
      Array.from(activeFirstYearCourseIds).some(courseId => enrolledStudentIdsByCourse.get(courseId)?.has(user.id))
    );
    const secondYearStudents = students.filter(user =>
      Array.from(activeSecondYearCourseIds).some(courseId => enrolledStudentIdsByCourse.get(courseId)?.has(user.id))
    );
    const teachers = otherUsers.filter(user => user.roles.includes('teacher'));
    const staff = otherUsers.filter(user =>
      user.roles.some(role => ['administrator', 'teacher', 'mentor', 'translator', 'team_leader'].includes(role))
    );

    return [
      {
        key: 'all',
        label: t('common.all'),
        helper: t('messages.audience.all.helper'),
        icon: Users,
        recipientIds: otherUsers.map(user => user.id),
      },
      {
        key: 'students',
        label: t('common.students'),
        helper: t('messages.audience.students.helper'),
        icon: GraduationCap,
        recipientIds: students.map(user => user.id),
      },
      {
        key: 'first_years',
        label: t('common.yearGroup.first'),
        helper: t('messages.audience.firstYears.helper'),
        icon: GraduationCap,
        recipientIds: firstYearStudents.map(user => user.id),
      },
      {
        key: 'second_years',
        label: t('common.yearGroup.second'),
        helper: t('messages.audience.secondYears.helper'),
        icon: GraduationCap,
        recipientIds: secondYearStudents.map(user => user.id),
      },
      {
        key: 'teachers',
        label: t('common.teachers'),
        helper: t('messages.audience.teachers.helper'),
        icon: UserCheck,
        recipientIds: teachers.map(user => user.id),
      },
      {
        key: 'staff',
        label: t('common.staff'),
        helper: t('messages.audience.staff.helper'),
        icon: ShieldCheck,
        recipientIds: staff.map(user => user.id),
      },
    ];
  }, [activeFirstYearCourseIds, activeSecondYearCourseIds, canStartConversations, currentUser.id, enrolledStudentIdsByCourse, language, t, users]);

  const selectedConversation = conversations.find(c => c.otherUserId === selectedUserId) ?? null;
  const selectedUser = users.find(u => u.id === selectedUserId);
  const otherUserName = selectedConversation?.otherUserName ?? selectedUser?.name ?? '';
  const threadMessages = selectedConversation?.messages ?? [];
  const selectedAudience = audienceOptions.find(option => option.key === selectedAudienceKey) ?? null;

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter(c =>
      (c.audienceLabel ?? c.otherUserName).toLowerCase().includes(q) ||
      c.lastMessage.toLowerCase().includes(q)
    );
  }, [conversations, searchQuery]);

  const composeCandidates = useMemo(() => {
    const q = composeSearchQuery.trim().toLowerCase();
    return users
      .filter(u => u.id !== currentUser.id)
      .filter(u => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [composeSearchQuery, currentUser.id, users]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threadMessages.length, selectedUserId]);

  const handleSelectConversation = (conv: Conversation) => {
    setSelectedUserId(conv.otherUserId);
    setComposeMode(false);
    if (!conv.audienceKey) onMarkAsRead(conv.otherUserId);
  };

  const handleNewMessage = () => {
    if (!canStartConversations) return;
    setComposeMode(true);
    setSelectedUserId(null);
    setSelectedAudienceKey(null);
    setComposeSearchQuery('');
  };

  const handleCancelCompose = () => {
    setComposeMode(false);
    setSelectedUserId(null);
    setSelectedAudienceKey(null);
    setComposeSearchQuery('');
  };

  const handleMobileBack = () => {
    setSelectedUserId(null);
    setComposeMode(false);
    setSelectedAudienceKey(null);
    setComposeSearchQuery('');
  };

  const handleSelectComposeUser = (user: User) => {
    setSelectedUserId(user.id);
    setSelectedAudienceKey(null);
    setComposeMode(false);
    setComposeSearchQuery('');
  };

  const handleSelectAudience = (audience: AudienceOption) => {
    if (audience.recipientIds.length === 0) return;
    setSelectedAudienceKey(audience.key);
    setSelectedUserId(null);
  };

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;
    if (composeMode && selectedAudience) {
      await onSend(selectedAudience.recipientIds, newMessage, {
        key: selectedAudience.key,
        label: selectedAudience.label,
      });
      setComposeMode(false);
      setSelectedAudienceKey(null);
      setNewMessage('');
      return;
    }
    if (!selectedUserId) return;
    if (!canStartConversations && !selectedConversation) return;
    await onSend(selectedUserId, newMessage);
    setNewMessage('');
  };

  const canReplyInThread = (canStartConversations || !!selectedConversation) && !selectedConversation?.audienceKey;
  const showThreadPanel = selectedUserId !== null && !composeMode;
  const showComposePanel = composeMode && canStartConversations;

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('messages.title')}
        description={t('messages.subtitle')}
        action={
          canStartConversations ? (
            <button
              type="button"
              onClick={handleNewMessage}
              className="tbo-focus flex w-full items-center justify-center gap-2 rounded-lg bg-[#171717] px-4 py-2 text-sm font-medium text-white hover:bg-[#404040] sm:w-auto"
              aria-label={t('messages.newAria')}
            >
              <Plus className="h-4 w-4" />
              <span>{t('messages.new')}</span>
            </button>
          ) : undefined
        }
      />

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex min-h-[60vh] flex-col overflow-hidden rounded-xl border border-[#e5e5e5] bg-white lg:h-[calc(100vh-12rem)] lg:min-h-[520px] lg:flex-row">
        <div
          className={`flex w-full shrink-0 flex-col border-[#e5e5e5] lg:w-80 lg:border-r ${
            mobileShowThread ? 'hidden lg:flex' : 'flex'
          }`}
        >
          <div className="border-b border-[#e5e5e5] px-4 py-3">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a3a3a3]" />
              <input
                type="search"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={t('messages.search.placeholder')}
                className="tbo-focus h-10 w-full rounded-lg border border-[#d4d4d4] bg-[#fafafa] pl-9 pr-3 text-sm text-[#171717] placeholder:text-[#a3a3a3]"
              />
            </label>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div
                  className="h-6 w-6 animate-spin rounded-full border-2 border-[#e5e5e5] border-t-[#171717]"
                  role="status"
                  aria-label={t('messages.loadingAria')}
                />
                <p className="mt-3 text-sm text-[#737373]">{t('messages.loading')}</p>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <MessageSquare className="mx-auto mb-3 h-10 w-10 text-[#d4d4d4]" />
                <p className="text-sm text-[#737373]">
                  {canStartConversations
                    ? t('messages.empty.canStart')
                    : t('messages.empty.readOnly')}
                </p>
              </div>
            ) : (
              filteredConversations.map(conv => (
                <ConversationListItem
                  key={conv.otherUserId}
                  conversation={conv}
                  otherUser={users.find(u => u.id === conv.otherUserId)}
                  isSelected={selectedUserId === conv.otherUserId}
                  onSelect={() => handleSelectConversation(conv)}
                />
              ))
            )}
          </div>
        </div>

        <div
          className={`flex min-w-0 flex-1 flex-col ${
            mobileShowThread ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {showComposePanel && (
            <>
              <div className="flex items-center gap-3 border-b border-[#e5e5e5] px-4 py-3">
                <button
                  type="button"
                  onClick={handleMobileBack}
                  className="tbo-focus rounded-lg p-1.5 text-[#525252] hover:bg-[#f5f5f5] lg:hidden"
                  aria-label={t('messages.backToConversations')}
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <h3 className="flex-1 text-base font-semibold text-[#171717]">{t('messages.newMessage')}</h3>
                <button
                  type="button"
                  onClick={handleCancelCompose}
                  className="tbo-focus rounded-lg p-1.5 text-[#525252] hover:bg-[#f5f5f5]"
                  aria-label={t('messages.cancel')}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3 border-b border-[#e5e5e5] px-4 py-3">
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#737373]">{t('messages.groups')}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {audienceOptions.map(audience => {
                      const Icon = audience.icon;
                      const active = selectedAudienceKey === audience.key;
                      return (
                        <button
                          key={audience.key}
                          type="button"
                          disabled={audience.recipientIds.length === 0}
                          onClick={() => handleSelectAudience(audience)}
                          className={`tbo-focus rounded-xl border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                            active
                              ? 'border-[#bfdbfe] bg-[#eff6ff]'
                              : 'border-[#e5e5e5] bg-white hover:bg-[#fafafa]'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span className={`grid h-8 w-8 place-items-center rounded-lg ${active ? 'bg-white text-[#2563eb]' : 'bg-[#f5f5f5] text-[#525252]'}`}>
                              <Icon className="h-4 w-4" />
                            </span>
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold text-[#171717]">{audience.label}</span>
                              <span className="block truncate text-xs text-[#737373]">{t('messages.recipientsCount', { count: audience.recipientIds.length, helper: audience.helper })}</span>
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a3a3a3]" />
                  <input
                    type="search"
                    value={composeSearchQuery}
                    onChange={e => setComposeSearchQuery(e.target.value)}
                    placeholder={t('messages.searchPerson.placeholder')}
                    className="tbo-focus h-10 w-full rounded-lg border border-[#d4d4d4] bg-[#fafafa] pl-9 pr-3 text-sm text-[#171717] placeholder:text-[#a3a3a3]"
                  />
                </label>
              </div>

              <div className="flex-1 overflow-y-auto">
                {selectedAudience ? (
                  <div className="p-4">
                    <div className="rounded-2xl border border-[#bfdbfe] bg-[#eff6ff] p-4">
                      <p className="text-sm font-semibold text-[#1d4ed8]">{selectedAudience.label}</p>
                      <p className="mt-1 text-sm text-[#2563eb]">
                        {tCount('messages.willSendTo', selectedAudience.recipientIds.length)}
                      </p>
                    </div>
                  </div>
                ) : composeCandidates.length === 0 ? (
                  <p className="py-8 text-center text-sm text-[#737373]">{t('messages.noUsers')}</p>
                ) : (
                  composeCandidates.map(user => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => handleSelectComposeUser(user)}
                      className="tbo-focus flex w-full gap-3 border-b border-[#f0f0f0] px-4 py-3 text-left hover:bg-[#fafafa]"
                    >
                      <UserAvatar user={user} size="lg" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#171717]">{user.name}</p>
                        <p className="truncate text-xs text-[#737373]">{user.email}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
              {selectedAudience && (
                <ComposeArea
                  newMessage={newMessage}
                  sending={sending}
                  onChange={setNewMessage}
                  onSend={handleSend}
                />
              )}
            </>
          )}

          {showThreadPanel && (
            <>
              <div className="flex items-center gap-3 border-b border-[#e5e5e5] px-4 py-3">
                <button
                  type="button"
                  onClick={handleMobileBack}
                  className="tbo-focus rounded-lg p-1.5 text-[#525252] hover:bg-[#f5f5f5] lg:hidden"
                  aria-label={t('messages.backToConversations')}
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                {selectedConversation?.audienceKey ? (
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#dbeaff] text-[#2563eb] ring-1 ring-[#bfdbfe]">
                    <Users className="h-4 w-4" />
                  </div>
                ) : (
                  <UserAvatar
                    user={{ name: otherUserName, avatarUrl: selectedUser?.avatarUrl }}
                    size="lg"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#171717]">{selectedConversation?.audienceLabel ?? otherUserName}</p>
                  {selectedConversation?.audienceKey && (
                    <p className="text-xs text-[#737373]">{tCount('messages.recipientsLabel', selectedConversation.recipientIds.length)}</p>
                  )}
                </div>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto bg-[#fafafa] px-4 py-4">
                {threadMessages.length === 0 ? (
                  <p className="py-8 text-center text-sm text-[#737373]">
                    {t('messages.threadEmpty')}
                  </p>
                ) : (
                  groupMessagesByDate(threadMessages).map(group => (
                    <div key={group.dateKey}>
                      <div className="my-4 flex items-center gap-3">
                        <div className="flex-1 border-t border-[#e5e5e5]" />
                        <span className="shrink-0 text-[11px] font-medium text-[#a3a3a3]">{group.label}</span>
                        <div className="flex-1 border-t border-[#e5e5e5]" />
                      </div>
                      <div className="space-y-3">
                        {group.messages.map(msg => (
                          <MessageBubble
                            key={msg.id}
                            message={msg}
                            isMine={msg.senderId === currentUser.id}
                            onDelete={onDeleteMessage}
                          />
                        ))}
                      </div>
                    </div>
                  ))
                )}
                <div ref={bottomRef} />
              </div>

              {selectedConversation?.audienceKey && (
                <div className="border-t border-[#bfdbfe] bg-[#eff6ff] px-4 py-3 text-sm text-[#1d4ed8]">
                  {t('messages.audienceNotice')}
                </div>
              )}

              {canReplyInThread && (
                <ComposeArea
                  newMessage={newMessage}
                  sending={sending}
                  onChange={setNewMessage}
                  onSend={handleSend}
                />
              )}
            </>
          )}

          {!showComposePanel && !showThreadPanel && (
            <div className="flex flex-1 flex-col items-center justify-center bg-[#fafafa] px-4 text-center">
              <div className="grid h-16 w-16 place-items-center rounded-2xl border border-[#e5e5e5] bg-white text-[#a3a3a3]">
                <MessageSquare className="h-7 w-7" />
              </div>
              <p className="mt-4 max-w-xs text-sm text-[#737373]">
                {canStartConversations
                  ? t('messages.selectPrompt.canStart')
                  : t('messages.selectPrompt.readOnly')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
