import { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  Send,
  Pencil,
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
import { formatPlatformDate } from '../../utils/dateUtils';

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

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24 && startOfDate.getTime() === startOfToday.getTime()) {
    return `${hours}h ago`;
  }
  if (startOfDate.getTime() === startOfYesterday.getTime()) return 'Yesterday';
  if (diffMs < 7 * 86400000) return formatPlatformDate(dateString);
  return formatPlatformDate(dateString);
}

function formatBubbleTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString('en-GB', {
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

  if (startOfDate.getTime() === startOfToday.getTime()) return 'Today';
  if (startOfDate.getTime() === startOfYesterday.getTime()) return 'Yesterday';
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
    size === 'sm' ? 'w-6 h-6 text-xs' :
    size === 'lg' ? 'w-12 h-12 text-xl' :
    'w-8 h-8 text-sm';

  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.name}
        className={`${sizeClass} rounded-full object-cover shrink-0`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold shrink-0`}
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
      className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-gray-50 transition-colors border-b border-gray-100 ${
        isSelected ? 'bg-amber-50' : ''
      }`}
    >
      {isAudience ? (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700">
          <Users className="h-5 w-5" />
        </div>
      ) : (
        <UserAvatar
          user={otherUser ?? { name: conversation.otherUserName }}
          size="lg"
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-sm truncate ${hasUnread ? 'font-bold text-gray-900' : 'font-medium text-gray-900'}`}>
            {conversation.audienceLabel ?? conversation.otherUserName}
          </span>
          <span className="text-xs text-gray-400 shrink-0">
            {formatListTimestamp(conversation.lastMessageAt)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-1">
          <p className={`text-sm truncate ${hasUnread ? 'font-semibold text-gray-700' : 'text-gray-500'}`}>
            {conversation.lastMessage}
          </p>
          {hasUnread && (
            <span className="shrink-0 min-w-[1.25rem] h-5 px-1.5 flex items-center justify-center rounded-full bg-amber-600 text-white text-xs font-medium">
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
  return (
    <div className={`group flex ${isMine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`relative max-w-[75%] rounded-lg px-3 py-2 ${
          isMine
            ? 'bg-amber-600 text-white'
            : 'bg-white border border-gray-200 text-gray-900'
        }`}
      >
        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        <div className={`flex items-center gap-2 mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
          <span className={`text-xs ${isMine ? 'text-amber-100' : 'text-gray-400'}`}>
            {formatBubbleTime(message.createdAt)}
          </span>
          {isMine && (
            <button
              type="button"
              onClick={() => onDelete(message.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-amber-700"
              aria-label="Delete message"
            >
              <Trash2 className="w-3.5 h-3.5 text-amber-100" />
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
    <div className="border-t border-gray-200 p-4 flex gap-2 items-end bg-white">
      <textarea
        ref={textareaRef}
        value={newMessage}
        onChange={e => onChange(e.target.value)}
        onInput={adjustHeight}
        onKeyDown={handleKeyDown}
        placeholder="Write a message..."
        rows={1}
        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-amber-500 focus:border-transparent max-h-24"
      />
      <button
        type="button"
        onClick={onSend}
        disabled={!newMessage.trim() || sending}
        className="p-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        aria-label="Send message"
      >
        <Send className="w-5 h-5" />
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
  const firstYearStudentIds = new Set(courseStudents
    .filter(row => row.status === 'active' && activeFirstYearCourseIds.has(row.courseId))
    .map(row => row.studentId));
  const secondYearStudentIds = new Set(courseStudents
    .filter(row => row.status === 'active' && activeSecondYearCourseIds.has(row.courseId))
    .map(row => row.studentId));

  const filteredConversations = conversations.filter(conv =>
    conv.otherUserName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedConversation = conversations.find(c => c.otherUserId === selectedUserId);
  const selectedUser = users.find(u => u.id === selectedUserId);
  const threadMessages = selectedConversation?.messages ?? [];

  const otherUserName =
    selectedConversation?.otherUserName ?? selectedUser?.name ?? 'Unknown';

  const activeUsers = users.filter(u => u.id !== currentUser.id);
  const audienceOptions: AudienceOption[] = [
    {
      key: '@all',
      label: '@all',
      helper: 'Everyone except you',
      icon: Users,
      recipientIds: activeUsers.map(user => user.id),
    },
    {
      key: '@students',
      label: '@students',
      helper: 'All students',
      icon: GraduationCap,
      recipientIds: activeUsers.filter(user => user.roles.includes('student')).map(user => user.id),
    },
    {
      key: '@firstYears',
      label: '@firstYears',
      helper: 'First Year students',
      icon: GraduationCap,
      recipientIds: activeUsers.filter(user => firstYearStudentIds.has(user.id)).map(user => user.id),
    },
    {
      key: '@secondYears',
      label: '@secondYears',
      helper: 'Second Year students',
      icon: GraduationCap,
      recipientIds: activeUsers.filter(user => secondYearStudentIds.has(user.id)).map(user => user.id),
    },
    {
      key: '@teachers',
      label: '@teachers',
      helper: 'Teachers',
      icon: UserCheck,
      recipientIds: activeUsers.filter(user => user.roles.includes('teacher')).map(user => user.id),
    },
    {
      key: '@staff',
      label: '@staff',
      helper: 'Admins, teachers, mentors, translators, leaders',
      icon: ShieldCheck,
      recipientIds: activeUsers.filter(user => user.roles.some(role => role !== 'student' && role !== 'dev')).map(user => user.id),
    },
  ].map(option => ({ ...option, recipientIds: Array.from(new Set(option.recipientIds)) }));

  const composeCandidates = activeUsers
    .filter(u => u.id !== currentUser.id)
    .filter(u => u.name.toLowerCase().includes(composeSearchQuery.toLowerCase()));
  const selectedAudience = audienceOptions.find(option => option.key === selectedAudienceKey);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedUserId, threadMessages.length]);

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
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-col lg:flex-row min-h-[60vh] lg:h-[calc(100vh-8rem)] lg:min-h-[500px] bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        {/* Left panel */}
        <div
          className={`w-full lg:w-80 shrink-0 border-r border-gray-200 flex flex-col ${
            mobileShowThread ? 'hidden lg:flex' : 'flex'
          }`}
        >
          <div className="px-4 py-4 border-b border-gray-200 flex items-center justify-between gap-2">
            <h2 className="text-2xl font-bold text-gray-900">Messages</h2>
            {canStartConversations && (
              <button
                type="button"
                onClick={handleNewMessage}
                className="bg-amber-600 text-white p-2 rounded-lg hover:bg-amber-700 flex items-center gap-1.5 text-sm font-medium"
                aria-label="New message"
              >
                <Pencil className="w-4 h-4" />
                <span className="hidden sm:inline">New Message</span>
              </button>
            )}
          </div>

          <div className="px-4 py-3 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search conversations..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div
                  className="w-6 h-6 border-2 border-amber-200 border-t-amber-600 rounded-full animate-spin"
                  role="status"
                  aria-label="Loading messages"
                />
                <p className="text-sm text-gray-400 mt-3">Loading messages...</p>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="text-center py-12 px-4">
                <MessageSquare className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">
                  {canStartConversations
                    ? 'No messages yet. Start a conversation!'
                    : 'No messages yet.'}
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

        {/* Right panel */}
        <div
          className={`flex-1 flex flex-col min-w-0 ${
            mobileShowThread ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {showComposePanel && (
            <>
              <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleMobileBack}
                  className="lg:hidden p-1 rounded-lg hover:bg-gray-100 text-gray-600"
                  aria-label="Back to conversations"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h3 className="text-lg font-semibold text-gray-900 flex-1">New Message</h3>
                <button
                  type="button"
                  onClick={handleCancelCompose}
                  className="p-1 rounded-lg hover:bg-gray-100 text-gray-600"
                  aria-label="Cancel"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="px-4 py-3 border-b border-gray-200 space-y-3">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">Groups</p>
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
                          className={`rounded-xl border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                            active ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${active ? 'bg-white text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                              <Icon className="h-4 w-4" />
                            </span>
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold text-gray-900">{audience.label}</span>
                              <span className="block truncate text-xs text-gray-500">{audience.recipientIds.length} recipients · {audience.helper}</span>
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={composeSearchQuery}
                    onChange={e => setComposeSearchQuery(e.target.value)}
                    placeholder="Or search for one person..."
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {selectedAudience ? (
                  <div className="p-4">
                    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                      <p className="text-sm font-semibold text-blue-900">{selectedAudience.label}</p>
                      <p className="mt-1 text-sm text-blue-700">
                        This message will be sent to {selectedAudience.recipientIds.length} people.
                      </p>
                    </div>
                  </div>
                ) : composeCandidates.length === 0 ? (
                  <p className="text-center text-gray-500 text-sm py-8">No users found.</p>
                ) : (
                  composeCandidates.map(user => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => handleSelectComposeUser(user)}
                      className="w-full text-left px-4 py-3 flex gap-3 hover:bg-gray-50 border-b border-gray-100"
                    >
                      <UserAvatar user={user} size="lg" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{user.name}</p>
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
              <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleMobileBack}
                  className="lg:hidden p-1 rounded-lg hover:bg-gray-100 text-gray-600"
                  aria-label="Back to conversations"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                {selectedConversation?.audienceKey ? (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                    <Users className="h-5 w-5" />
                  </div>
                ) : (
                  <UserAvatar
                    user={{ name: otherUserName, avatarUrl: selectedUser?.avatarUrl }}
                    size="lg"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{selectedConversation?.audienceLabel ?? otherUserName}</p>
                  {selectedConversation?.audienceKey && (
                    <p className="text-xs text-gray-500">{selectedConversation.recipientIds.length} recipients</p>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {threadMessages.length === 0 ? (
                  <p className="text-center text-gray-400 text-sm py-8">
                    No messages yet. Say hello!
                  </p>
                ) : (
                  groupMessagesByDate(threadMessages).map(group => (
                    <div key={group.dateKey}>
                      <div className="flex items-center gap-3 my-4">
                        <div className="flex-1 border-t border-gray-200" />
                        <span className="text-xs text-gray-400 shrink-0">{group.label}</span>
                        <div className="flex-1 border-t border-gray-200" />
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
                <div className="border-t border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                  Audience messages are broadcast copies. Replies happen as direct conversations with the admin.
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
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
              <MessageSquare className="w-16 h-16 text-gray-300 mb-4" />
              <p className="text-gray-500">
                {canStartConversations
                  ? 'Select a conversation or start a new one'
                  : 'Select a conversation'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
