import type { FormEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Check,
  ChevronDown,
  Circle,
  ClipboardList,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { useLanguage } from '../../i18n/LanguageContext';
import { translate } from '../../i18n/translate';
import type { TodoAssignmentCategory, TodoItem, TodoPriority, User } from '../../types/lms';
import { formatPlatformDate } from '../../utils/dateUtils';

type TodoFilter = 'open' | 'today' | 'priority' | 'completed';
type TodoGroupKey = 'overdue' | 'today' | 'tomorrow' | 'later' | 'completed';

const filterAccentClasses: Record<TodoFilter, { active: string; inactive: string }> = {
  open: {
    active: 'border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]',
    inactive: 'border-[#e5e5e5] bg-white text-[#525252] hover:border-[#bfdbfe] hover:bg-[#eff6ff] hover:text-[#1d4ed8]',
  },
  today: {
    active: 'border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]',
    inactive: 'border-[#e5e5e5] bg-white text-[#525252] hover:border-[#bbf7d0] hover:bg-[#f0fdf4] hover:text-[#15803d]',
  },
  priority: {
    active: 'border-[#fed7aa] bg-[#fff7ed] text-[#c2410c]',
    inactive: 'border-[#e5e5e5] bg-white text-[#525252] hover:border-[#fed7aa] hover:bg-[#fff7ed] hover:text-[#c2410c]',
  },
  completed: {
    active: 'border-[#d4d4d4] bg-[#f5f5f5] text-[#171717]',
    inactive: 'border-[#e5e5e5] bg-white text-[#525252] hover:bg-[#f5f5f5] hover:text-[#171717]',
  },
};

interface TodosViewProps {
  todos: TodoItem[];
  assignableUsers: User[];
  assignmentCategories: TodoAssignmentCategory[];
  currentUser: User;
  loading: boolean;
  error: string | null;
  isAdmin: boolean;
  canCreate: boolean;
  openCreateOnMount?: boolean;
  onCreate: (input: {
    title: string;
    description?: string | null;
    assignedTo?: string;
    assignedToIds?: string[];
    assignmentType?: 'person' | 'category';
    targetLabel?: string;
    targetIds?: string[];
    dueDate: string;
    priority: TodoPriority;
  }) => Promise<TodoItem>;
  onUpdate: (todoId: number, updates: Partial<{
    title: string;
    description: string | null;
    assignedTo: string;
    dueDate: string;
    priority: TodoPriority;
    status: TodoItem['status'];
  }>) => Promise<TodoItem>;
  onToggleStatus: (todoId: number, completed: boolean) => Promise<TodoItem>;
  onDelete: (todoId: number) => Promise<void>;
}

function todayKey() {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function addDaysKey(value: string, days: number) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatDate(value: string) {
  return formatPlatformDate(value);
}

function getTodoGroupKey(todo: TodoItem): TodoGroupKey {
  if (todo.status === 'completed') return 'completed';
  const today = todayKey();
  if (todo.dueDate < today) return 'overdue';
  if (todo.dueDate === today) return 'today';
  if (todo.dueDate === addDaysKey(today, 1)) return 'tomorrow';
  return 'later';
}

const groupClassNames: Record<TodoGroupKey, string> = {
  overdue: 'text-[#c2410c]',
  today: 'text-[#1d4ed8]',
  tomorrow: 'text-[#15803d]',
  later: 'text-[#525252]',
  completed: 'text-[#525252]',
};

const groupLabelKeys: Record<TodoGroupKey, 'todos.group.overdue' | 'todos.group.today' | 'todos.group.tomorrow' | 'todos.group.later' | 'todos.group.completed'> = {
  overdue: 'todos.group.overdue',
  today: 'todos.group.today',
  tomorrow: 'todos.group.tomorrow',
  later: 'todos.group.later',
  completed: 'todos.group.completed',
};

const categoryToneClasses: Record<TodoAssignmentCategory['tone'], string> = {
  blue: 'border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]',
  green: 'border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]',
  orange: 'border-[#fed7aa] bg-[#fff7ed] text-[#c2410c]',
  violet: 'border-[#ddd6fe] bg-[#f5f3ff] text-[#6d28d9]',
  gray: 'border-[#e5e5e5] bg-[#f5f5f5] text-[#525252]',
};

function isOverdue(todo: TodoItem) {
  return todo.status === 'open' && todo.dueDate < todayKey();
}

function getDueMeta(todo: TodoItem) {
  const today = todayKey();
  if (todo.status === 'completed') {
    return {
      label: translate('todos.due.done'),
      className: 'border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]',
    };
  }
  if (todo.dueDate < today) {
    return {
      label: translate('todos.due.overdue'),
      className: 'border-[#fed7aa] bg-[#fff7ed] text-[#c2410c]',
    };
  }
  if (todo.dueDate === today) {
    return {
      label: translate('todos.due.today'),
      className: 'border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]',
    };
  }
  return {
    label: formatDate(todo.dueDate),
    className: 'border-[#e5e5e5] bg-[#fafafa] text-[#525252]',
  };
}

function getInitials(name: string | null) {
  if (!name) return 'U';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('') || 'U';
}

function TodoAvatar({
  name,
  avatarUrl,
  size = 'md',
}: {
  name: string | null;
  avatarUrl: string | null;
  size?: 'sm' | 'md';
}) {
  return (
    <span className={`grid flex-shrink-0 place-items-center overflow-hidden rounded-full border border-[#e5e5e5] bg-[#f5f5f5] font-semibold text-[#525252] ${
      size === 'sm' ? 'h-6 w-6 text-[10px]' : 'h-8 w-8 text-[11px]'
    }`}>
      {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : getInitials(name)}
    </span>
  );
}

export function TodosView({
  todos,
  assignableUsers,
  assignmentCategories,
  currentUser,
  loading,
  error,
  isAdmin,
  canCreate,
  openCreateOnMount = false,
  onCreate,
  onUpdate,
  onToggleStatus,
  onDelete,
}: TodosViewProps) {
  const { t, tCount, language } = useLanguage();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([currentUser.id]);
  const [dueDate, setDueDate] = useState(todayKey());
  const [priority, setPriority] = useState<TodoPriority>('none');
  const [filter, setFilter] = useState<TodoFilter>('open');
  const [query, setQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [busyTodoId, setBusyTodoId] = useState<number | null>(null);
  const [assigneePickerOpen, setAssigneePickerOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(openCreateOnMount && canCreate);
  const [editingTodo, setEditingTodo] = useState<TodoItem | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [assignmentMode, setAssignmentMode] = useState<'person' | 'category'>('person');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [assigneeQuery, setAssigneeQuery] = useState('');
  const assigneePickerRef = useRef<HTMLDivElement | null>(null);

  const selectedAssignees = useMemo(() => {
    const ids = isAdmin ? selectedAssigneeIds : [currentUser.id];
    const byId = new Map(assignableUsers.map(user => [user.id, user]));
    return ids
      .map(id => byId.get(id) ?? (id === currentUser.id ? currentUser : null))
      .filter((user): user is User => Boolean(user));
  }, [assignableUsers, currentUser.id, isAdmin, selectedAssigneeIds]);
  const selectedCategoryUserIds = useMemo(() => {
    const selectedCategories = assignmentCategories.filter(category => selectedCategoryIds.includes(category.id));
    return Array.from(new Set(selectedCategories.flatMap(category => category.userIds)));
  }, [assignmentCategories, selectedCategoryIds]);
  const selectedPersonLabel = useMemo(() => {
    if (selectedAssignees.length === 0) return '';
    if (selectedAssignees.length === 1) return selectedAssignees[0].name;
    return tCount('todos.peopleCount', selectedAssignees.length);
  }, [language, selectedAssignees, tCount]);
  const selectedCategoryLabel = useMemo(() => {
    const labels = assignmentCategories
      .filter(category => selectedCategoryIds.includes(category.id))
      .map(category => category.label);
    if (labels.length === 0) return '';
    if (labels.length === 1) return labels[0];
    return tCount('todos.categoriesCount', labels.length);
  }, [assignmentCategories, language, selectedCategoryIds, tCount]);
  const filteredAssignableUsers = useMemo(() => {
    const normalized = assigneeQuery.trim().toLowerCase();
    if (!normalized) return assignableUsers;
    return assignableUsers.filter(user => [
      user.name,
      user.email,
      user.roles.filter(role => role !== 'dev').join(' '),
    ].some(value => value.toLowerCase().includes(normalized)));
  }, [assignableUsers, assigneeQuery]);
  const selectedRecipientCount = assignmentMode === 'category'
    ? selectedCategoryUserIds.length
    : selectedAssignees.length;

  const counts = useMemo(() => ({
    open: todos.filter(todo => todo.status === 'open').length,
    today: todos.filter(todo => todo.status === 'open' && todo.dueDate === todayKey()).length,
    priority: todos.filter(todo => todo.status === 'open' && todo.priority === 'priority').length,
    completed: todos.filter(todo => todo.status === 'completed').length,
  }), [todos]);
  const overdueCount = useMemo(
    () => todos.filter(todo => isOverdue(todo)).length,
    [todos]
  );

  const filteredTodos = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return todos
      .filter(todo => {
        if (filter === 'open' && todo.status !== 'open') return false;
        if (filter === 'today' && (todo.status !== 'open' || todo.dueDate !== todayKey())) return false;
        if (filter === 'priority' && (todo.status !== 'open' || todo.priority !== 'priority')) return false;
        if (filter === 'completed' && todo.status !== 'completed') return false;
        if (!normalizedQuery) return true;
        return [
          todo.title,
          todo.description ?? '',
          todo.assignedToName ?? '',
          todo.createdByName ?? '',
          todo.targetLabel ?? '',
        ].some(value => value.toLowerCase().includes(normalizedQuery));
      })
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === 'open' ? -1 : 1;
        if (a.priority !== b.priority) return a.priority === 'priority' ? -1 : 1;
        return a.dueDate.localeCompare(b.dueDate);
      });
  }, [filter, query, todos]);
  const groupedTodos = useMemo(() => {
    const order: TodoGroupKey[] = filter === 'completed'
      ? ['completed']
      : ['overdue', 'today', 'tomorrow', 'later'];

    return order
      .map(key => ({
        key,
        items: filteredTodos.filter(todo => getTodoGroupKey(todo) === key),
      }))
      .filter(group => group.items.length > 0);
  }, [filter, filteredTodos]);

  useEffect(() => {
    if (!assigneePickerOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!assigneePickerRef.current?.contains(event.target as Node)) {
        setAssigneePickerOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAssigneePickerOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [assigneePickerOpen]);

  const resetTodoForm = () => {
    setTitle('');
    setDescription('');
    setSelectedAssigneeIds([currentUser.id]);
    setAssignmentMode('person');
    setSelectedCategoryIds([]);
    setAssigneeQuery('');
    setDueDate(todayKey());
    setPriority('none');
  };

  const closeTodoModal = () => {
    setCreateModalOpen(false);
    setEditingTodo(null);
    setAssigneePickerOpen(false);
    setAssigneeQuery('');
  };

  const openCreateTodoModal = () => {
    setEditingTodo(null);
    resetTodoForm();
    setCreateModalOpen(true);
  };

  const openEditTodoModal = (todo: TodoItem) => {
    if (todo.readOnly) return;
    setEditingTodo(todo);
    setTitle(todo.title);
    setDescription(todo.description ?? '');
    setSelectedAssigneeIds([todo.assignedTo || currentUser.id]);
    setAssignmentMode('person');
    setSelectedCategoryIds([]);
    setAssigneeQuery('');
    setDueDate(todo.dueDate);
    setPriority(todo.priority);
    setAssigneePickerOpen(false);
    setCreateModalOpen(true);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim()) return;
    const isEditing = Boolean(editingTodo);
    if (isAdmin && assignmentMode === 'person' && selectedAssignees.length === 0) return;
    if (!isEditing && isAdmin && assignmentMode === 'category' && selectedCategoryUserIds.length === 0) return;
    setSubmitting(true);
    try {
      if (editingTodo) {
        await onUpdate(editingTodo.id, {
          title: title.trim(),
          description: description.trim() || null,
          assignedTo: isAdmin ? selectedAssignees[0]?.id : currentUser.id,
          dueDate,
          priority,
        });
      } else {
        await onCreate({
          title,
          description,
          assignedTo: isAdmin ? selectedAssignees[0]?.id : currentUser.id,
          assignedToIds: isAdmin
            ? assignmentMode === 'category'
              ? selectedCategoryUserIds
              : selectedAssignees.map(user => user.id)
            : undefined,
          assignmentType: isAdmin && assignmentMode === 'category' ? 'category' : 'person',
          targetLabel: isAdmin && assignmentMode === 'category' ? selectedCategoryLabel : selectedPersonLabel,
          targetIds: isAdmin && assignmentMode === 'category'
            ? selectedCategoryIds
            : selectedAssignees.map(user => user.id),
          dueDate,
          priority,
        });
      }
      resetTodoForm();
      closeTodoModal();
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (todo: TodoItem) => {
    if (todo.readOnly) return;
    setBusyTodoId(todo.id);
    try {
      await onToggleStatus(todo.id, todo.status !== 'completed');
    } finally {
      setBusyTodoId(null);
    }
  };

  const handleDelete = async (todo: TodoItem) => {
    if (todo.readOnly) return;
    setBusyTodoId(todo.id);
    try {
      await onDelete(todo.id);
    } finally {
      setBusyTodoId(null);
    }
  };

  const statCards = useMemo(() => ([
    {
      label: t('todos.stats.open'),
      value: counts.open,
      icon: ClipboardList,
      className: 'border-[#bfdbfe] bg-white',
      iconClassName: 'bg-[#eff6ff] text-[#2563eb]',
    },
    {
      label: t('todos.stats.today'),
      value: counts.today,
      icon: Calendar,
      className: 'border-[#bbf7d0] bg-white',
      iconClassName: 'bg-[#f0fdf4] text-[#16a34a]',
    },
    {
      label: t('todos.stats.priority'),
      value: counts.priority,
      icon: AlertCircle,
      className: 'border-[#fed7aa] bg-white',
      iconClassName: 'bg-[#fff7ed] text-[#ea580c]',
    },
    {
      label: overdueCount > 0 ? t('todos.stats.overdue') : t('todos.stats.done'),
      value: overdueCount > 0 ? overdueCount : counts.completed,
      icon: overdueCount > 0 ? AlertCircle : Check,
      className: overdueCount > 0 ? 'border-[#fed7aa] bg-white' : 'border-[#e5e5e5] bg-white',
      iconClassName: overdueCount > 0 ? 'bg-[#fff7ed] text-[#c2410c]' : 'bg-[#f5f5f5] text-[#525252]',
    },
  ] as const), [counts, language, overdueCount, t]);

  const filterTabs = useMemo(() => ([
    ['open', t('todos.filter.open'), counts.open],
    ['today', t('todos.filter.today'), counts.today],
    ['priority', t('todos.filter.priority'), counts.priority],
    ['completed', t('todos.filter.done'), counts.completed],
  ] as const), [counts, language, t]);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('todos.title')}
        action={canCreate ? (
          <button
            type="button"
            onClick={openCreateTodoModal}
            className="tbo-focus inline-flex items-center gap-2 rounded-full bg-[#171717] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#404040]"
          >
            <Plus className="h-4 w-4" />
            {t('todos.new')}
          </button>
        ) : undefined}
      />

      <section className="grid gap-3 md:grid-cols-4">
        {statCards.map(item => {
          const Icon = item.icon;
          return (
            <div key={item.label} className={`rounded-2xl border p-4 shadow-[0_1px_0_rgba(0,0,0,0.03)] ${item.className}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{item.label}</p>
                  <p className="mt-1 text-2xl font-semibold leading-none text-[#171717]">{item.value}</p>
                </div>
                <span className={`grid h-10 w-10 place-items-center rounded-xl ${item.iconClassName}`}>
                  <Icon className="h-5 w-5" />
                </span>
              </div>
            </div>
          );
        })}
      </section>

      <section className="tbo-panel overflow-hidden bg-white shadow-[0_18px_50px_rgba(15,23,42,0.04)]">
        <div className="border-b border-[#e5e5e5] p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {filterTabs.map(([id, label, count]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  className={`tbo-focus rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                    filter === id ? filterAccentClasses[id].active : filterAccentClasses[id].inactive
                  }`}
                >
                  {label} <span className="opacity-70">{count}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setSearchOpen(open => !open)}
              className={`tbo-focus inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                searchOpen || query
                  ? 'border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]'
                  : 'border-[#e5e5e5] bg-white text-[#525252] hover:bg-[#f5f5f5]'
              }`}
            >
              <Search className="h-4 w-4" />
              {t('todos.search')}
            </button>
          </div>
          {searchOpen && (
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a3a3a3]" />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder={t('todos.search.placeholder')}
                className="tbo-focus w-full rounded-full border border-[#e5e5e5] bg-white py-2 pl-9 pr-10 text-sm text-[#171717] placeholder:text-[#a3a3a3]"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="tbo-focus absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-[#737373] hover:bg-[#f5f5f5] hover:text-[#171717]"
                  aria-label={t('todos.search.clear')}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="p-4">

            {error && (
              <div className="mb-3 rounded-xl border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-sm text-[#b91c1c]">
                {error}
              </div>
            )}

            <div className="max-h-[34rem] overflow-y-auto pr-1 tbo-scrollbar">
              {loading ? (
                <div className="grid h-56 place-items-center rounded-2xl border border-dashed border-[#d4d4d4] bg-[#fafafa] text-sm text-[#737373]">{t('todos.loading')}</div>
              ) : filteredTodos.length === 0 ? (
                <div className="grid h-56 place-items-center rounded-2xl border border-dashed border-[#d4d4d4] bg-[#fafafa] text-center">
                  <div>
                    <span className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-xl bg-white text-[#16a34a] shadow-[0_1px_0_rgba(0,0,0,0.04)]">
                      <Check className="h-5 w-5" />
                    </span>
                    <p className="text-sm font-semibold text-[#171717]">{t('todos.empty.title')}</p>
                    <p className="mt-1 text-xs text-[#737373]">{t('todos.empty.subtitle')}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  {groupedTodos.map(group => (
                      <section key={group.key} className="space-y-2">
                        <div className="flex items-center gap-2 px-1">
                          <p className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${groupClassNames[group.key]}`}>
                            {t(groupLabelKeys[group.key])}
                          </p>
                          <span className="h-px flex-1 bg-[#eeeeee]" />
                          <span className="text-[11px] font-medium text-[#a3a3a3]">{group.items.length}</span>
                        </div>

                        <div className="space-y-2">
                          {group.items.map(todo => {
                            const dueMeta = getDueMeta(todo);
                            return (
                              <article
                                key={todo.id}
                                className={`group grid gap-3 rounded-2xl border bg-white p-3 transition-colors sm:grid-cols-[auto_1fr_auto_auto_auto] sm:items-center ${
                        todo.priority === 'priority'
                          ? 'border-[#fed7aa] hover:bg-[#fffaf5]'
                          : isOverdue(todo)
                            ? 'border-[#fed7aa] hover:bg-[#fffaf5]'
                            : 'border-[#e5e5e5] hover:border-[#d4d4d4] hover:bg-[#fafafa]'
                      }`}
                              >
                                {todo.readOnly ? (
                                  <span
                                    className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full border border-[#e9d5ff] bg-[#f3e8ff] text-[#7c3aed]"
                                    aria-label={t('todos.scheduled.aria')}
                                    title={t('todos.scheduled.title')}
                                  >
                                    <Calendar className="h-4 w-4" />
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleToggle(todo)}
                                    disabled={busyTodoId === todo.id}
                                    className={`tbo-focus grid h-8 w-8 flex-shrink-0 place-items-center rounded-full border transition-colors ${
                                      todo.status === 'completed'
                                        ? 'border-[#bbf7d0] bg-[#f0fdf4] text-[#16a34a]'
                                        : 'border-[#d4d4d4] bg-white text-[#737373] hover:border-[#171717] hover:text-[#171717]'
                                    }`}
                                    aria-label={todo.status === 'completed' ? t('todos.markOpen') : t('todos.markCompleted')}
                                  >
                                    {todo.status === 'completed' ? <Check className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                                  </button>
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="flex min-w-0 items-center gap-2">
                                    <p className={`truncate text-sm font-semibold ${todo.status === 'completed' ? 'text-[#737373] line-through' : 'text-[#171717]'}`}>
                                      {todo.title}
                                    </p>
                                    {todo.priority === 'priority' && (
                                      <span className="rounded-full bg-[#fff7ed] px-2 py-0.5 text-[11px] font-medium text-[#c2410c]">
                                        {t('todos.priority.badge')}
                                      </span>
                                    )}
                                    {todo.readOnly && (
                                      <span className="rounded-full bg-[#f3e8ff] px-2 py-0.5 text-[11px] font-medium text-[#7c3aed]">
                                        {t('todos.scheduled.badge')}
                                      </span>
                                    )}
                                  </div>
                                  {todo.description && (
                                    <p className="mt-0.5 truncate text-xs text-[#737373]">{todo.description}</p>
                                  )}
                                  {todo.assignmentType === 'category' && todo.targetLabel && (
                                    <span className="mt-1 inline-flex w-fit items-center rounded-full bg-[#f5f5f5] px-2 py-0.5 text-[11px] font-medium text-[#737373]">
                                      {t('todos.fromLabel', { label: todo.targetLabel })}
                                      {todo.recipientCount && todo.recipientCount > 1 ? ` (${todo.recipientCount})` : ''}
                                    </span>
                                  )}
                                </div>
                                {group.key === 'today' ? (
                                  <span className="hidden sm:block" aria-hidden="true" />
                                ) : (
                                  <div className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${dueMeta.className}`}>
                                    <Calendar className="h-3.5 w-3.5" />
                                    <span>{dueMeta.label}</span>
                                  </div>
                                )}
                                <div className="flex min-w-[9rem] items-center gap-2 rounded-full bg-[#fafafa] px-2 py-1">
                                  <TodoAvatar name={todo.assignedToName} avatarUrl={todo.assignedToAvatarUrl} />
                                  <div className="min-w-0">
                                    <p className="truncate text-xs font-semibold text-[#171717]">{todo.assignedToName ?? t('common.unknown')}</p>
                                  </div>
                                </div>
                                {!todo.readOnly && (
                                  <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                                    <button
                                      type="button"
                                      onClick={() => openEditTodoModal(todo)}
                                      disabled={busyTodoId === todo.id}
                                      className="tbo-focus grid h-8 w-8 flex-shrink-0 place-items-center rounded-full text-[#a3a3a3] transition-colors hover:bg-[#eff6ff] hover:text-[#2563eb]"
                                      aria-label={t('todos.edit')}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDelete(todo)}
                                      disabled={busyTodoId === todo.id}
                                      className="tbo-focus grid h-8 w-8 flex-shrink-0 place-items-center rounded-full text-[#a3a3a3] transition-colors hover:bg-[#fef2f2] hover:text-[#dc2626]"
                                      aria-label={t('todos.delete')}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                )}
                              </article>
                            );
                          })}
                        </div>
                      </section>
                    ))}
                </div>
              )}
            </div>
        </div>
      </section>

      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-xl rounded-t-3xl border border-[#e5e5e5] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.24)] sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-[#e5e5e5] px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl border border-[#fed7aa] bg-[#fff7ed] text-[#ea580c]">
                  <Plus className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-[#171717]">{editingTodo ? t('todos.edit.title') : t('todos.create.title')}</p>
                  <p className="text-xs text-[#737373]">
                    {editingTodo ? t('todos.edit.subtitle') : isAdmin ? t('todos.create.subtitleAdmin') : t('todos.create.subtitleStaff')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeTodoModal}
                className="tbo-focus grid h-9 w-9 place-items-center rounded-full text-[#737373] hover:bg-[#f5f5f5] hover:text-[#171717]"
                aria-label={t('todos.create.close')}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 p-5">
              <input
                value={title}
                onChange={event => setTitle(event.target.value)}
                placeholder={t('todos.create.placeholderTitle')}
                className="tbo-focus w-full rounded-xl border border-[#e5e5e5] bg-white px-3 py-2.5 text-sm text-[#171717] placeholder:text-[#a3a3a3]"
              />
              <textarea
                value={description}
                onChange={event => setDescription(event.target.value)}
                placeholder={t('todos.create.placeholderDescription')}
                rows={4}
                className="tbo-focus w-full resize-none rounded-xl border border-[#e5e5e5] bg-white px-3 py-2.5 text-sm text-[#171717] placeholder:text-[#a3a3a3]"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{t('todos.create.due')}</span>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={event => setDueDate(event.target.value)}
                    className="tbo-focus w-full rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm text-[#171717]"
                  />
                </label>
                <div className="block">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{t('todos.create.priority')}</span>
                  <button
                    type="button"
                    onClick={() => setPriority(current => current === 'priority' ? 'none' : 'priority')}
                    className={`tbo-focus flex h-[38px] w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                      priority === 'priority'
                        ? 'border-[#fed7aa] bg-[#fff7ed] text-[#c2410c]'
                        : 'border-[#e5e5e5] bg-white text-[#525252] hover:bg-[#f5f5f5]'
                    }`}
                    aria-pressed={priority === 'priority'}
                  >
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      <span>{priority === 'priority' ? t('todos.create.priorityOn') : t('todos.create.priorityOff')}</span>
                    </span>
                    <span className={`h-2 w-2 rounded-full ${priority === 'priority' ? 'bg-[#ea580c]' : 'bg-[#d4d4d4]'}`} />
                  </button>
                </div>
              </div>
              {isAdmin && (
                <div className="space-y-3 rounded-2xl border border-[#e5e5e5] bg-[#fafafa] p-3">
                  <div className={`grid gap-3 sm:items-end ${editingTodo ? '' : 'sm:grid-cols-[auto_minmax(0,1fr)]'}`}>
                    {!editingTodo && (
                      <div>
                        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{t('todos.create.type')}</span>
                        <div className="inline-grid grid-cols-2 rounded-full border border-[#e5e5e5] bg-white p-1">
                          {([
                            ['person', t('todos.create.type.people')],
                            ['category', t('todos.create.type.category')],
                          ] as const).map(([mode, label]) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => {
                                setAssignmentMode(mode);
                                setAssigneePickerOpen(false);
                                setAssigneeQuery('');
                              }}
                              className={`tbo-focus rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                                assignmentMode === mode
                                  ? 'bg-[#171717] text-white'
                                  : 'text-[#737373] hover:bg-[#f5f5f5] hover:text-[#171717]'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="block min-w-0">
                      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{t('todos.create.assign')}</span>
                      <div ref={assigneePickerRef} className="relative z-40">
                        <button
                          type="button"
                          onClick={() => setAssigneePickerOpen(open => !open)}
                          className="tbo-focus flex h-[38px] w-full items-center gap-2 rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-left text-sm text-[#171717] transition-colors hover:border-[#d4d4d4] hover:bg-[#fafafa]"
                          aria-haspopup="listbox"
                          aria-expanded={assigneePickerOpen}
                        >
                          {assignmentMode === 'category' ? (
                            <span className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-[#f5f5f5] text-[10px] font-semibold text-[#525252]">
                              {selectedCategoryUserIds.length}
                            </span>
                          ) : selectedAssignees.length > 1 ? (
                            <span className="flex -space-x-2">
                              {selectedAssignees.slice(0, 3).map(user => (
                                <TodoAvatar key={user.id} name={user.name} avatarUrl={user.avatarUrl} size="sm" />
                              ))}
                            </span>
                          ) : (
                            <TodoAvatar name={selectedAssignees[0]?.name ?? null} avatarUrl={selectedAssignees[0]?.avatarUrl ?? null} size="sm" />
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold">
                              {assignmentMode === 'category'
                                ? tCount('todos.create.categoryRecipients', selectedCategoryUserIds.length)
                                : selectedPersonLabel || t('todos.create.selectPeople')}
                            </span>
                          </span>
                          <ChevronDown className={`h-4 w-4 flex-shrink-0 text-[#737373] transition-transform ${assigneePickerOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {assigneePickerOpen && (
                          <div className="absolute right-0 z-[80] mt-2 w-full overflow-hidden rounded-2xl border border-[#e5e5e5] bg-white shadow-[0_18px_40px_rgba(0,0,0,0.12)]" role="listbox">
                            {assignmentMode === 'person' && (
                              <div className="border-b border-[#eeeeee] p-2">
                                <div className="relative">
                                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a3a3a3]" />
                                  <input
                                    value={assigneeQuery}
                                    onChange={event => setAssigneeQuery(event.target.value)}
                                    placeholder={t('todos.create.searchPeople')}
                                    className="tbo-focus h-9 w-full rounded-full border border-[#e5e5e5] bg-[#fafafa] pl-9 pr-3 text-sm text-[#171717] placeholder:text-[#a3a3a3]"
                                  />
                                </div>
                              </div>
                            )}
                            <div className="max-h-72 overflow-y-auto p-1.5 tbo-scrollbar">
                              {assignmentMode === 'person' ? (
                                filteredAssignableUsers.length === 0 ? (
                                  <p className="px-3 py-4 text-center text-sm text-[#737373]">{t('todos.create.noPeople')}</p>
                                ) : filteredAssignableUsers.map(user => {
                                  const selected = selectedAssigneeIds.includes(user.id);
                                  return (
                                    <button
                                      key={user.id}
                                      type="button"
                                      onClick={() => {
                                        setSelectedAssigneeIds(current =>
                                          current.includes(user.id)
                                            ? current.filter(id => id !== user.id)
                                            : [...current, user.id]
                                        );
                                      }}
                                      className={`tbo-focus flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-colors ${
                                        selected ? 'bg-[#f5f5f5] text-[#171717]' : 'text-[#525252] hover:bg-[#fafafa] hover:text-[#171717]'
                                      }`}
                                      role="option"
                                      aria-selected={selected}
                                    >
                                      <TodoAvatar name={user.name} avatarUrl={user.avatarUrl} />
                                      <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-semibold">{user.name}</span>
                                        <span className="block truncate text-[11px] text-[#737373]">
                                          {user.roles.filter(role => role !== 'dev').join(', ') || t('todos.create.noRole')}
                                        </span>
                                      </span>
                                      <span className={`grid h-6 w-6 flex-shrink-0 place-items-center rounded-full border ${
                                        selected
                                          ? 'border-[#171717] bg-[#171717] text-white'
                                          : 'border-[#d4d4d4] bg-white text-transparent'
                                      }`}>
                                        <Check className="h-3.5 w-3.5" />
                                      </span>
                                    </button>
                                  );
                                })
                              ) : assignmentCategories.map(category => {
                                const selected = selectedCategoryIds.includes(category.id);
                                return (
                                  <button
                                    key={category.id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedCategoryIds(current =>
                                        current.includes(category.id)
                                          ? current.filter(id => id !== category.id)
                                          : [...current, category.id]
                                      );
                                    }}
                                    className={`tbo-focus flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors ${
                                      selected ? categoryToneClasses[category.tone] : 'text-[#525252] hover:bg-[#fafafa] hover:text-[#171717]'
                                    }`}
                                    role="option"
                                    aria-selected={selected}
                                  >
                                    <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-white text-[#525252]">
                                      <Users className="h-4 w-4" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                      <span className="block truncate text-sm font-semibold text-[#171717]">{category.label}</span>
                                      <span className="block truncate text-[11px] text-[#737373]">{category.description}</span>
                                    </span>
                                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                      selected ? 'bg-white/75 text-[#171717]' : 'bg-[#f5f5f5] text-[#737373]'
                                    }`}>
                                      {category.userIds.length}
                                    </span>
                                    <span className={`grid h-6 w-6 flex-shrink-0 place-items-center rounded-full border ${
                                      selected
                                        ? 'border-[#171717] bg-[#171717] text-white'
                                        : 'border-[#d4d4d4] bg-white text-transparent'
                                    }`}>
                                      <Check className="h-3.5 w-3.5" />
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                            <div className="border-t border-[#eeeeee] px-3 py-2 text-xs font-medium text-[#737373]">
                              {selectedRecipientCount > 0
                                ? tCount('todos.create.recipientsSelected', selectedRecipientCount)
                                : assignmentMode === 'person'
                                  ? t('todos.create.selectRecipientsPeople')
                                  : t('todos.create.selectRecipientsCategories')}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-end gap-3 border-t border-[#e5e5e5] pt-4">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={closeTodoModal}
                    className="tbo-focus rounded-full border border-[#e5e5e5] bg-white px-4 py-2 text-sm font-semibold text-[#525252] hover:bg-[#f5f5f5]"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={
                      !title.trim() ||
                      submitting ||
                      (isAdmin && assignmentMode === 'person' && selectedAssignees.length === 0) ||
                      (!editingTodo && isAdmin && assignmentMode === 'category' && selectedCategoryUserIds.length === 0)
                    }
                    className="tbo-focus rounded-full bg-[#171717] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#404040] disabled:cursor-not-allowed disabled:bg-[#d4d4d4]"
                  >
                    {submitting
                      ? editingTodo ? t('todos.edit.saving') : t('todos.create.adding')
                      : editingTodo ? t('todos.edit.save') : t('todos.create.add')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
