import { useEffect, useRef, useState } from 'react';
import type { User } from '../../types/lms';
import type { WorkspaceId } from '../../types/workspace';
import { WORKSPACE_LABEL_KEYS } from '../../types/workspace';
import {
  ArrowLeft,
  Megaphone,
  MessageSquare,
  BookOpen,
  LayoutDashboard,
  Users,
  UserCheck,
  TrendingUp,
  Calendar,
  GraduationCap,
  Settings,
  PanelLeftClose,
  PanelLeft,
  ClipboardList,
  ListTodo,
  BarChart2,
  Shield,
  Search,
  X,
  Languages,
  Clock3,
  Activity,
  ShieldCheck,
  HeartHandshake,
  Inbox,
  MailCheck,
  Banknote,
  Bell,
  Check,
  CreditCard,
  LogOut,
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { ROLE_META } from '../../views/admin/users/usersShared';
import { formatRoleLabel } from '../../utils/userManagementUtils';

interface SidebarProps {
  currentUser: User;
  activeView: string;
  onNavigate: (view: string) => void;
  onSignOut: () => void;
  hasRole: (role: string) => boolean;
  totalUnread: number;
  announcementDraftCount: number;
  todoTodayCount: number;
  pendingUserCount?: number;
  isOnDuty: boolean;
  activeWorkspace: WorkspaceId | null;
  availableWorkspaces: WorkspaceId[];
  onWorkspaceChange: (workspace: WorkspaceId) => void;
  canAssignSessionTranslators?: boolean;
  mode: 'locked' | 'collapsed';
  onToggleMode: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

type NavItem = {
  id: string;
  label: string;
  description?: string;
  icon: typeof LayoutDashboard;
  roles?: string[];
  workspaces?: WorkspaceId[];
  shared?: boolean;
  badge?: string;
  tone?: 'default' | 'alert';
  /** When true, only shown if canAssignSessionTranslators is true. */
  requiresTranslationTeamLead?: boolean;
};

type NavSection = {
  label: string;
  items: NavItem[];
};

export function Sidebar({
  currentUser,
  activeView,
  onNavigate,
  onSignOut,
  hasRole,
  totalUnread,
  announcementDraftCount,
  todoTodayCount,
  pendingUserCount = 0,
  isOnDuty,
  activeWorkspace,
  availableWorkspaces,
  onWorkspaceChange,
  canAssignSessionTranslators = false,
  mode,
  onToggleMode,
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const isExpanded = mode === 'locked';
  const { t } = useLanguage();
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const workspaceMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!workspaceMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!workspaceMenuRef.current?.contains(event.target as Node)) {
        setWorkspaceMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [workspaceMenuOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onMobileClose?.();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [mobileOpen, onMobileClose]);

  const attendanceItems: NavItem[] = [
    {
      id: 'attendance-overview',
      label: t('common.overview'),
      description: t('nav.attendance.overview.desc'),
      icon: ClipboardList,
      roles: ['administrator'],
      workspaces: ['administrator'],
    },
    {
      id: 'attendance-date',
      label: t('nav.attendance.date'),
      description: t('nav.attendance.date.desc'),
      icon: Search,
      roles: ['administrator'],
      workspaces: ['administrator'],
    },
    {
      id: 'attendance-classes',
      label: t('nav.attendance.classes'),
      description: t('nav.attendance.classes.desc'),
      icon: Calendar,
      roles: ['administrator'],
      workspaces: ['administrator'],
    },
    {
      id: 'attendance-well',
      label: t('nav.attendance.well'),
      description: t('nav.attendance.well.desc'),
      icon: Activity,
      roles: ['administrator'],
      workspaces: ['administrator'],
    },
    {
      id: 'attendance-ministry',
      label: t('nav.attendance.ministry'),
      description: t('nav.attendance.ministry.desc'),
      icon: UserCheck,
      roles: ['administrator'],
      workspaces: ['administrator'],
    },
    {
      id: 'attendance-activation',
      label: t('nav.attendance.activation'),
      description: t('nav.attendance.activation.desc'),
      icon: ShieldCheck,
      roles: ['administrator'],
      workspaces: ['administrator'],
    },
    {
      id: 'attendance-duty',
      label: t('nav.attendance.duty'),
      description: t('nav.attendance.duty.desc'),
      icon: Users,
      roles: ['administrator'],
      workspaces: ['administrator'],
    },
    {
      id: 'attendance-prayer',
      label: t('nav.attendance.prayer'),
      description: t('nav.attendance.prayer.desc'),
      icon: HeartHandshake,
      roles: ['administrator'],
      workspaces: ['administrator'],
    },
    {
      id: 'attendance-settings',
      label: t('sidebar.settings'),
      description: t('nav.attendance.settings.desc'),
      icon: Settings,
      roles: ['administrator'],
      workspaces: ['administrator'],
    },
  ];

  const curriculumItems: NavItem[] = [
    {
      id: 'curriculum-overview',
      label: t('common.overview'),
      description: t('nav.curriculum.overview.desc'),
      icon: BookOpen,
      roles: ['administrator', 'team_leader'],
      workspaces: ['administrator', 'team_leader'],
      requiresTranslationTeamLead: true,
    },
    {
      id: 'curriculum-date-view',
      label: t('nav.curriculum.dateView'),
      description: t('nav.curriculum.dateView.desc'),
      icon: Calendar,
      roles: ['administrator', 'team_leader'],
      workspaces: ['administrator', 'team_leader'],
      requiresTranslationTeamLead: true,
    },
    {
      id: 'curriculum-planning',
      label: t('nav.curriculum.planning'),
      description: t('nav.curriculum.planning.desc'),
      icon: Calendar,
      roles: ['administrator'],
      workspaces: ['administrator'],
    },
    {
      id: 'curriculum-books',
      label: t('nav.curriculum.books'),
      description: t('nav.curriculum.books.desc'),
      icon: BookOpen,
      roles: ['administrator'],
      workspaces: ['administrator'],
    },
    {
      id: 'curriculum-archived',
      label: t('nav.curriculum.archived'),
      description: t('nav.curriculum.archived.desc'),
      icon: Clock3,
      roles: ['administrator'],
      workspaces: ['administrator'],
    },
  ];


  const myAttendanceItems: NavItem[] = [
    {
      id: 'my-attendance-overview',
      label: t('nav.myAttendance.overall'),
      description: t('nav.myAttendance.overall.desc'),
      icon: BarChart2,
      roles: ['student'],
      workspaces: ['student'],
    },
    {
      id: 'my-attendance-breakdown',
      label: t('nav.myAttendance.history'),
      description: t('nav.myAttendance.history.desc'),
      icon: Calendar,
      roles: ['student'],
      workspaces: ['student'],
    },
    {
      id: 'my-attendance-ministry',
      label: t('nav.attendance.ministry'),
      description: t('nav.myAttendance.ministry.desc'),
      icon: HeartHandshake,
      roles: ['student'],
      workspaces: ['student'],
    },
  ];

  const usersItems: NavItem[] = [
    {
      id: 'users-directory',
      label: t('nav.users.directory'),
      description: t('nav.users.directory.desc'),
      icon: Users,
      roles: ['administrator'],
      workspaces: ['administrator'],
      badge: pendingUserCount > 0 ? (pendingUserCount > 9 ? '9+' : String(pendingUserCount)) : undefined,
    },
    {
      id: 'users-pending',
      label: t('nav.users.pending'),
      description: t('nav.users.pending.desc'),
      icon: Clock3,
      roles: ['administrator'],
      workspaces: ['administrator'],
      badge: pendingUserCount > 0 ? (pendingUserCount > 9 ? '9+' : String(pendingUserCount)) : undefined,
      tone: pendingUserCount > 0 ? 'alert' : 'default',
    },
    {
      id: 'users-enrollments',
      label: t('nav.users.enrollments'),
      description: t('nav.users.enrollments.desc'),
      icon: GraduationCap,
      roles: ['administrator'],
      workspaces: ['administrator'],
    },
    {
      id: 'users-staff',
      label: t('nav.users.staff'),
      description: t('nav.users.staff.desc'),
      icon: UserCheck,
      roles: ['administrator'],
      workspaces: ['administrator'],
    },
  ];

  const mentorshipItems: NavItem[] = [
    {
      id: 'mentorship-overview',
      label: t('common.overview'),
      description: t('nav.mentorship.overview.desc'),
      icon: Activity,
      roles: ['administrator'],
      workspaces: ['administrator'],
    },
    {
      id: 'mentorship-assignments',
      label: t('nav.mentorship.assignments'),
      description: t('nav.mentorship.assignments.desc'),
      icon: UserCheck,
      roles: ['administrator'],
      workspaces: ['administrator'],
    },
    {
      id: 'mentorship-follow-up',
      label: t('nav.mentorship.followUp'),
      description: t('nav.mentorship.followUp.desc'),
      icon: TrendingUp,
      roles: ['administrator'],
      workspaces: ['administrator'],
    },
    {
      id: 'mentorship-check-in-rules',
      label: t('nav.mentorship.checkInRules'),
      description: t('nav.mentorship.checkInRules.desc'),
      icon: Settings,
      roles: ['administrator'],
      workspaces: ['administrator'],
    },
  ];

  const classworkItems: NavItem[] = [
    {
      id: 'my-classes',
      label: t('sidebar.mySessions'),
      description: t('nav.classwork.mySessions.desc'),
      icon: Calendar,
      roles: ['teacher'],
      workspaces: ['teacher'],
    },
    {
      id: activeWorkspace === 'student' ? 'my-classwork' : 'classwork',
      label: t('nav.classwork.classwork'),
      description: t('nav.classwork.classwork.desc'),
      icon: BookOpen,
      roles: ['administrator', 'teacher', 'student'],
      workspaces: ['administrator', 'teacher', 'student'],
    },
    {
      id: 'curriculum-books',
      label: t('nav.curriculum.books'),
      description: t('nav.curriculum.books.desc'),
      icon: BookOpen,
      roles: ['administrator', 'teacher'],
      workspaces: ['administrator', 'teacher'],
    },
    {
      id: 'submissions',
      label: t('nav.classwork.submissions'),
      description: t('nav.classwork.submissions.desc'),
      icon: ClipboardList,
      roles: ['administrator', 'teacher'],
      workspaces: ['administrator', 'teacher'],
    },
    {
      id: 'my-assignments',
      label: t('nav.classwork.assignments'),
      description: t('nav.classwork.assignments.desc'),
      icon: ClipboardList,
      roles: ['student'],
      workspaces: ['student'],
    },
    {
      id: 'absence-notices',
      label: t('nav.classwork.absenceNotices'),
      description: activeWorkspace === 'student' ? t('nav.classwork.absenceNotices.descStudent') : t('nav.classwork.absenceNotices.descStaff'),
      icon: Calendar,
      roles: ['administrator', 'student'],
      workspaces: ['administrator', 'student'],
    },
    {
      id: activeWorkspace === 'student' ? 'my-grades' : 'grades',
      label: t('nav.classwork.grades'),
      description: t('nav.classwork.grades.desc'),
      icon: BarChart2,
      roles: ['administrator', 'teacher', 'student'],
      workspaces: ['administrator', 'teacher', 'student'],
    },
  ];

  const tuitionItems: NavItem[] = [
    {
      id: 'tuition-overview',
      label: t('common.overview'),
      description: t('nav.tuition.overview.desc'),
      icon: LayoutDashboard,
      roles: ['administrator'],
      workspaces: ['administrator'],
    },
    {
      id: 'tuition-students',
      label: t('common.students'),
      description: t('nav.tuition.students.desc'),
      icon: Users,
      roles: ['administrator'],
      workspaces: ['administrator'],
    },
    {
      id: 'tuition-payments',
      label: t('nav.tuition.payments'),
      description: t('nav.tuition.payments.desc'),
      icon: CreditCard,
      roles: ['administrator'],
      workspaces: ['administrator'],
    },
    {
      id: 'tuition-installments',
      label: t('nav.tuition.installments'),
      description: t('nav.tuition.installments.desc'),
      icon: Calendar,
      roles: ['administrator'],
      workspaces: ['administrator'],
    },
    {
      id: 'tuition-reminders',
      label: t('nav.tuition.reminders'),
      description: t('nav.tuition.reminders.desc'),
      icon: Bell,
      roles: ['administrator'],
      workspaces: ['administrator'],
    },
    {
      id: 'tuition-settings',
      label: t('common.settings'),
      description: t('nav.tuition.settings.desc'),
      icon: Settings,
      roles: ['administrator'],
      workspaces: ['administrator'],
    },
  ];

  const sections: NavSection[] = [
    {
      label: '',
      items: [
        {
          id: 'dashboard',
          label: t('sidebar.dashboard'),
          description: t('sidebar.dashboard.desc'),
          icon: LayoutDashboard,
          roles: ['administrator', 'student', 'teacher', 'translator'],
          workspaces: ['administrator', 'student', 'teacher', 'translator'],
        },
      ],
    },
    {
      label: t('sidebar.school'),
      items: [
        {
          id: 'announcements',
          label: t('sidebar.announcements'),
          description: t('sidebar.announcements.desc'),
          icon: Megaphone,
          shared: true,
          badge: announcementDraftCount > 0 ? (announcementDraftCount > 9 ? '9+' : String(announcementDraftCount)) : undefined,
        },
        {
          id: 'messages',
          label: t('sidebar.messages'),
          description: t('sidebar.messages.desc'),
          icon: MessageSquare,
          shared: true,
          badge: totalUnread > 0 ? (totalUnread > 9 ? '9+' : String(totalUnread)) : undefined,
        },
        {
          id: 'todos',
          label: t('sidebar.todos'),
          description: t('sidebar.todos.desc'),
          icon: ListTodo,
          roles: ['administrator', 'teacher', 'translator', 'mentor', 'student'],
          shared: true,
          badge: todoTodayCount > 0 ? (todoTodayCount > 9 ? '9+' : String(todoTodayCount)) : undefined,
        },
        {
          id: 'calendar',
          label: t('sidebar.calendar'),
          description: t('sidebar.calendar.desc'),
          icon: Calendar,
          shared: true,
        },
        {
          id: 'classwork',
          label: t('sidebar.classroom'),
          description: t('sidebar.classroom.desc'),
          icon: BookOpen,
          roles: ['administrator', 'teacher'],
          workspaces: ['administrator', 'teacher'],
        },
      ],
    },
    {
      label: t('sidebar.care'),
      items: [
        {
          id: 'users-directory',
          label: t('sidebar.users'),
          description: t('sidebar.users.desc'),
          icon: Users,
          roles: ['administrator'],
          workspaces: ['administrator'],
          badge: pendingUserCount > 0 ? (pendingUserCount > 9 ? '9+' : String(pendingUserCount)) : undefined,
        },
        {
          id: 'attendance-overview',
          label: t('sidebar.attendance'),
          description: t('sidebar.attendance.desc'),
          icon: ClipboardList,
          roles: ['administrator'],
          workspaces: ['administrator'],
        },
        {
          id: 'mentorship-overview',
          label: t('sidebar.mentorship'),
          description: t('sidebar.mentorship.desc'),
          icon: UserCheck,
          roles: ['administrator'],
          workspaces: ['administrator'],
        },
      ],
    },
    {
      label: t('sidebar.operations'),
      items: [
        {
          id: 'curriculum-overview',
          label: t('sidebar.curriculum'),
          description: t('sidebar.curriculum.desc'),
          icon: BookOpen,
          roles: ['administrator', 'team_leader'],
          workspaces: ['administrator', 'team_leader'],
          requiresTranslationTeamLead: true,
        },
        {
          id: 'tuition-overview',
          label: t('sidebar.tuition'),
          description: t('sidebar.tuition.desc'),
          icon: Banknote,
          roles: ['administrator'],
          workspaces: ['administrator'],
        },
        {
          id: 'inbox',
          label: t('sidebar.inbox'),
          description: t('sidebar.inbox.desc'),
          icon: Inbox,
          roles: ['administrator'],
          workspaces: ['administrator'],
        },
        {
          id: 'email-log',
          label: t('sidebar.emailLog'),
          description: t('sidebar.emailLog.desc'),
          icon: MailCheck,
          roles: ['administrator'],
          workspaces: ['administrator'],
        },
        {
          id: 'environment-status',
          label: t('sidebar.environmentStatus'),
          description: t('sidebar.environmentStatus.desc'),
          icon: Activity,
          roles: ['administrator'],
          workspaces: ['administrator'],
        },
        {
          id: 'knowledge-base',
          label: t('sidebar.knowledgeBase'),
          description: t('sidebar.knowledgeBase.desc'),
          icon: BookOpen,
          roles: ['administrator'],
          workspaces: ['administrator'],
        },
        {
          id: 'settings',
          label: t('sidebar.settings'),
          description: t('sidebar.settings.desc'),
          icon: Settings,
          shared: true,
        },
      ],
    },
    {
      label: t('sidebar.myWork'),
      items: [
        {
          id: 'my-classes',
          label: t('sidebar.translationDesk'),
          description: t('sidebar.translationDesk.desc'),
          icon: Languages,
          roles: ['translator'],
          workspaces: ['translator'],
        },
        {
          id: 'mentor-dashboard',
          label: t('sidebar.mentorDashboard'),
          description: t('sidebar.mentorDashboard.desc'),
          icon: UserCheck,
          roles: ['mentor'],
          workspaces: ['mentor'],
        },
        {
          id: 'ministry-report',
          label: t('sidebar.ministryReport'),
          description: t('sidebar.ministryReport.desc'),
          icon: ClipboardList,
          roles: ['team_leader'],
          workspaces: ['team_leader'],
        },
        {
          id: 'my-classwork',
          label: t('sidebar.classroom'),
          description: t('sidebar.studentClassroom.desc'),
          icon: GraduationCap,
          roles: ['student'],
          workspaces: ['student'],
        },
        {
          id: 'my-books',
          label: t('sidebar.myBooks'),
          description: t('sidebar.myBooks.desc'),
          icon: BookOpen,
          roles: ['student'],
          workspaces: ['student'],
        },
        {
          id: 'on-duty',
          label: t('sidebar.onDuty'),
          description: t('sidebar.onDuty.desc'),
          icon: Shield,
          badge: t('sidebar.live'),
          tone: 'alert',
          roles: isOnDuty ? undefined : ['__hidden__'],
          shared: true,
        },
        {
          id: 'my-attendance-overview',
          label: t('sidebar.myAttendance'),
          description: t('sidebar.myAttendance.desc'),
          icon: BarChart2,
          roles: ['student'],
          workspaces: ['student'],
        },
      ],
    },
  ];

  const isNavItemVisible = (item: NavItem) => {
    const hasPermission = !item.roles || item.roles.some(role => hasRole(role));
    const fitsWorkspace =
      item.shared ||
      !item.workspaces ||
      !activeWorkspace ||
      item.workspaces.includes(activeWorkspace);
    const translationLeadOk =
      !item.requiresTranslationTeamLead ||
      hasRole('administrator') ||
      canAssignSessionTranslators;

    return hasPermission && fitsWorkspace && translationLeadOk;
  };

  const visibleSections = sections
    .map(section => ({
      ...section,
      items: section.items.filter(isNavItemVisible),
    }))
    .filter(section => section.items.length > 0);

  const visibleAttendanceItems = attendanceItems.filter(isNavItemVisible);
  const visibleCurriculumItems = curriculumItems.filter(isNavItemVisible);
  const visibleMentorshipItems = mentorshipItems.filter(isNavItemVisible);
  const visibleMyAttendanceItems = myAttendanceItems.filter(isNavItemVisible);
  const visibleUsersItems = usersItems.filter(isNavItemVisible);
  const visibleClassworkItems = classworkItems.filter(isNavItemVisible);
  const visibleTuitionItems = tuitionItems.filter(isNavItemVisible);
  const inAttendanceModule =
    activeView === 'attendance' ||
    activeView.startsWith('attendance-');
  const inClassworkModule =
    activeView === 'classwork' ||
    activeView === 'submissions' ||
    activeView === 'absence-notices' ||
    activeView === 'my-assignments' ||
    activeView === 'my-classes' ||
    activeView === 'grades' ||
    activeView === 'my-classwork' ||
    activeView === 'my-grades';
  const inCurriculumModule =
    activeView === 'curriculum' ||
    activeView.startsWith('curriculum-');
  const inMyAttendanceModule =
    activeView === 'my-attendance' ||
    activeView.startsWith('my-attendance-');
  const inMentorshipModule =
    activeView === 'mentorship' ||
    activeView === 'mentorship-management' ||
    activeView.startsWith('mentorship-');
  const inUsersModule =
    activeView === 'users' ||
    activeView.startsWith('users-');
  const inTuitionModule =
    activeView === 'tuition' ||
    activeView.startsWith('tuition-');
  const inSubmodule = inAttendanceModule || inClassworkModule || inCurriculumModule || inMentorshipModule || inMyAttendanceModule || inUsersModule || inTuitionModule;
  const workspaceLabel = activeWorkspace ? t(WORKSPACE_LABEL_KEYS[activeWorkspace]) : t('sidebar.workspace');
  const canSwitchWorkspace = !!activeWorkspace && availableWorkspaces.length > 1;
  const activeRoleMeta = activeWorkspace
    ? ROLE_META[activeWorkspace] ?? { icon: Users, className: 'border-[#d4d4d4] bg-white text-[#525252]' }
    : { icon: Users, className: 'border-[#d4d4d4] bg-[#fafafa] text-[#a3a3a3]' };
  const ActiveRoleIcon = activeRoleMeta.icon;
  const extraWorkspaceCount = Math.max(availableWorkspaces.length - 1, 0);
  const avatar = currentUser.avatarUrl ? (
    <img
      src={currentUser.avatarUrl}
      alt={currentUser.name}
      className="h-9 w-9 rounded-full border border-[#e5e5e5] object-cover"
    />
  ) : (
    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#e5e5e5] bg-[#f5f5f5] text-sm font-semibold text-[#171717]">
      {(currentUser.name || currentUser.email || '?').charAt(0).toUpperCase()}
    </div>
  );
  const submoduleLabel = inAttendanceModule
    ? t('sidebar.attendance')
    : inClassworkModule
      ? t('sidebar.classroom')
      : inCurriculumModule
      ? t('sidebar.curriculum')
      : inMentorshipModule
        ? t('sidebar.mentorship')
        : inMyAttendanceModule
          ? t('sidebar.myAttendance')
          : inUsersModule
          ? t('sidebar.users')
          : inTuitionModule
            ? t('sidebar.tuition')
            : workspaceLabel;
  const handleNavigate = (viewId: string) => {
    onNavigate(viewId);
    onMobileClose?.();
  };

  const toggleTitle = mode === 'locked' ? t('sidebar.collapse') : t('sidebar.expand');

  const renderItem = (item: NavItem, forceExpanded: boolean) => {
    const expanded = forceExpanded || isExpanded;
    const active =
      activeView === item.id ||
      (item.id === 'curriculum-overview' && activeView === 'curriculum') ||
      (item.id === 'attendance-overview' && activeView === 'attendance') ||
      (item.id === 'my-attendance-overview' && (activeView === 'my-attendance' || activeView === 'my-attendance-overview')) ||
      (item.id === 'users-directory' && (activeView === 'users' || activeView === 'users-directory')) ||
      (item.id === 'tuition-overview' && (activeView === 'tuition' || activeView === 'tuition-overview')) ||
      (item.id === 'mentorship-overview' &&
        (activeView === 'mentorship' || activeView === 'mentorship-management'));
    const alert = item.tone === 'alert';
    const Icon = item.icon;

    return (
      <button
        key={`${item.id}-${item.label}`}
        type="button"
        onClick={() => handleNavigate(item.id)}
        className={`tbo-focus group mx-2 flex w-[calc(100%-1rem)] items-center rounded-lg text-left text-sm transition-colors ${
          expanded ? 'gap-3 px-3 py-2.5' : 'justify-center px-0 py-2.5'
        } ${
          active
            ? alert
              ? 'bg-[#fff7ed] text-[#c2410c]'
              : 'bg-[#dbeaff] text-[#171717]'
            : alert
              ? 'text-[#c2410c] hover:bg-[#fff7ed]'
              : 'text-[#525252] hover:bg-[#f5f5f5] hover:text-[#171717]'
        }`}
        title={!expanded ? item.label : undefined}
      >
        <span
          className={`relative flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md ${
            active
              ? alert
                ? 'bg-white/80'
                : 'bg-white/70'
              : 'bg-transparent group-hover:bg-white'
          }`}
        >
          <Icon className="h-4 w-4" />
          {!expanded && item.badge && (
            <span className="absolute -right-1 -top-1 h-2.5 min-w-2.5 rounded-full bg-[#ea580c] ring-2 ring-white" />
          )}
        </span>
        {expanded && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium leading-5">{item.label}</span>
              {item.description && (
                <span className="block truncate text-xs leading-4 text-[#737373]">{item.description}</span>
              )}
            </span>
            {item.badge && (
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  alert ? 'bg-white text-[#c2410c]' : 'bg-white text-[#2563eb]'
                }`}
              >
                {item.badge}
              </span>
            )}
          </>
        )}
      </button>
    );
  };

  const renderAccountFooter = (forceExpanded: boolean) => {
    const expanded = forceExpanded || isExpanded;

    if (!expanded) {
      return (
        <div ref={workspaceMenuRef} className="relative border-t border-[#e5e5e5] p-2">
          <button
            type="button"
            onClick={() => {
              if (canSwitchWorkspace) setWorkspaceMenuOpen(open => !open);
            }}
            className={`tbo-focus relative flex w-full items-center justify-center rounded-lg p-2 transition-colors ${
              canSwitchWorkspace ? 'hover:bg-[#f5f5f5]' : ''
            }`}
            title={canSwitchWorkspace ? t('header.switchRole') : workspaceLabel}
            aria-label={canSwitchWorkspace ? t('header.switchRole') : workspaceLabel}
          >
            <span className={`flex h-8 w-8 items-center justify-center rounded-lg border ${activeRoleMeta.className}`}>
              <ActiveRoleIcon className="h-4 w-4" />
            </span>
            {extraWorkspaceCount > 0 && (
              <span className="absolute right-2 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#171717] px-1 text-[9px] font-semibold text-white">
                +{extraWorkspaceCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className="tbo-focus mt-1 flex w-full items-center justify-center rounded-lg p-2 text-[#737373] transition-colors hover:bg-[#fff8f6] hover:text-[#b42318]"
            title={t('header.signOut')}
            aria-label={t('header.signOut')}
          >
            <LogOut className="h-4 w-4" />
          </button>
          {canSwitchWorkspace && workspaceMenuOpen && (
            <div className="absolute bottom-[calc(100%+0.5rem)] left-2 z-50 w-56 rounded-xl border border-[#e5e5e5] bg-white p-1.5 shadow-[0_16px_40px_rgba(15,23,42,0.14)]">
              {availableWorkspaces.map(workspace => {
                const selected = workspace === activeWorkspace;
                const Icon = ROLE_META[workspace]?.icon ?? Users;
                return (
                  <button
                    key={workspace}
                    type="button"
                    onClick={() => {
                      onWorkspaceChange(workspace);
                      setWorkspaceMenuOpen(false);
                      onMobileClose?.();
                    }}
                    className={`tbo-focus flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                      selected ? 'bg-[#eff6ff] text-[#1d4ed8]' : 'text-[#525252] hover:bg-[#f5f5f5] hover:text-[#171717]'
                    }`}
                  >
                    <span className={`flex h-7 w-7 items-center justify-center rounded-md border ${
                      ROLE_META[workspace]?.className ?? 'border-[#d4d4d4] bg-white text-[#525252]'
                    }`}>
                      {selected ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {t(WORKSPACE_LABEL_KEYS[workspace]) || formatRoleLabel(workspace)}
                    </span>
                  </button>
                );
              })}
              <div className="my-1 h-px bg-[#e5e5e5]" />
              <button
                type="button"
                onClick={onSignOut}
                className="tbo-focus flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-[#b42318] transition-colors hover:bg-[#fff8f6]"
              >
                <LogOut className="h-4 w-4" />
                {t('header.signOut')}
              </button>
            </div>
          )}
        </div>
      );
    }

    return (
      <div ref={workspaceMenuRef} className="relative border-t border-[#e5e5e5] px-3 py-3">
        <div className="flex items-center gap-3 px-1">
          {avatar}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-5 text-[#171717]">{currentUser.name}</p>
            <p className="truncate text-xs leading-5 text-[#737373]">{currentUser.email}</p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={() => {
                if (canSwitchWorkspace) setWorkspaceMenuOpen(open => !open);
              }}
              className={`tbo-focus relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                canSwitchWorkspace ? 'hover:bg-[#f5f5f5]' : 'cursor-default'
              }`}
              title={canSwitchWorkspace ? t('header.switchRole') : workspaceLabel}
              aria-label={canSwitchWorkspace ? t('header.switchRole') : workspaceLabel}
              aria-expanded={canSwitchWorkspace ? workspaceMenuOpen : undefined}
            >
              <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border ${activeRoleMeta.className}`}>
                <ActiveRoleIcon className="h-3.5 w-3.5" />
              </span>
              {extraWorkspaceCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#171717] px-1 text-[9px] font-semibold text-white">
                  +{extraWorkspaceCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={onSignOut}
              className="tbo-focus flex h-9 w-9 items-center justify-center rounded-lg text-[#737373] transition-colors hover:bg-[#fff8f6] hover:text-[#b42318]"
              title={t('header.signOut')}
              aria-label={t('header.signOut')}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        {workspaceMenuOpen && (
          <div className="absolute bottom-[calc(100%+0.5rem)] left-3 right-3 z-50 rounded-xl border border-[#e5e5e5] bg-white p-1.5 shadow-[0_16px_40px_rgba(15,23,42,0.14)]">
            {availableWorkspaces.map(workspace => {
              const selected = workspace === activeWorkspace;
              const Icon = ROLE_META[workspace]?.icon ?? Users;
              return (
                <button
                  key={workspace}
                  type="button"
                  onClick={() => {
                    onWorkspaceChange(workspace);
                    setWorkspaceMenuOpen(false);
                    onMobileClose?.();
                  }}
                  className={`tbo-focus flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                    selected ? 'bg-[#eff6ff] text-[#1d4ed8]' : 'text-[#525252] hover:bg-[#f5f5f5] hover:text-[#171717]'
                  }`}
                >
                  <span className={`flex h-7 w-7 items-center justify-center rounded-md border ${
                    ROLE_META[workspace]?.className ?? 'border-[#d4d4d4] bg-white text-[#525252]'
                  }`}>
                    {selected ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {t(WORKSPACE_LABEL_KEYS[workspace]) || formatRoleLabel(workspace)}
                  </span>
                </button>
              );
            })}
            <div className="my-1 h-px bg-[#e5e5e5]" />
            <button
              type="button"
              onClick={onSignOut}
              className="tbo-focus flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-[#b42318] transition-colors hover:bg-[#fff8f6]"
            >
              <LogOut className="h-4 w-4" />
              {t('header.signOut')}
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderNavContent = (forceExpanded: boolean) => {
    const expanded = forceExpanded || isExpanded;
    const attendanceGroupIds = new Set([
      'attendance-overview',
      'attendance-classes',
      'attendance-date',
      'attendance-well',
      'attendance-ministry',
      'attendance-activation',
    ]);
    const navSections = inAttendanceModule && visibleAttendanceItems.length > 0
      ? [
          {
            label: t('sidebar.section.attendanceGroups'),
            items: visibleAttendanceItems.filter(item => attendanceGroupIds.has(item.id)),
          },
          {
            label: t('sidebar.operations'),
            items: visibleAttendanceItems.filter(item => !attendanceGroupIds.has(item.id)),
          },
        ].filter(section => section.items.length > 0)
      : inClassworkModule && visibleClassworkItems.length > 0
        ? [
            {
              label: t('sidebar.classroom'),
              items: visibleClassworkItems,
            },
          ]
      : inCurriculumModule && visibleCurriculumItems.length > 0
        ? [
            {
              label: t('sidebar.curriculum'),
              items: visibleCurriculumItems,
            },
          ]
      : inMentorshipModule && visibleMentorshipItems.length > 0
        ? [
            {
              label: t('sidebar.mentorship'),
              items: visibleMentorshipItems,
            },
          ]
        : inMyAttendanceModule && visibleMyAttendanceItems.length > 0
          ? [
              {
                label: t('sidebar.myAttendance'),
                items: visibleMyAttendanceItems,
              },
            ]
          : inUsersModule && visibleUsersItems.length > 0
            ? [
                {
                  label: t('sidebar.users'),
                  items: visibleUsersItems,
                },
              ]
            : inTuitionModule && visibleTuitionItems.length > 0
              ? [
                  {
                    label: t('sidebar.tuition'),
                    items: visibleTuitionItems,
                  },
                ]
            : visibleSections;

    return (
      <>
        <div
          className={`flex-shrink-0 border-b border-[#e5e5e5] py-3 ${
            forceExpanded ? 'px-4' : 'px-2'
          }`}
        >
          {forceExpanded ? (
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold text-[#171717]">{t('sidebar.menu')}</span>
                <p className="text-xs text-[#737373]">{t('sidebar.schoolWorkspace')}</p>
              </div>
              <button
                type="button"
                onClick={onMobileClose}
                className="tbo-focus rounded-lg p-2 text-[#737373] hover:bg-[#f5f5f5] hover:text-[#171717]"
                aria-label={t('sidebar.closeMenu')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className={`flex items-center ${expanded ? 'justify-between pl-2' : 'justify-center'}`}>
              {expanded && (
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold uppercase tracking-[0.18em] text-[#737373]">
                    {inSubmodule ? t('sidebar.module') : t('sidebar.workspace')}
                  </p>
                  <p className="truncate text-sm font-semibold text-[#171717]">
                    {inSubmodule ? submoduleLabel : workspaceLabel}
                  </p>
                </div>
              )}
              <button
                onClick={onToggleMode}
                title={toggleTitle}
                className="tbo-focus hidden rounded-lg p-1.5 text-sm text-[#737373] transition-colors hover:bg-[#f5f5f5] hover:text-[#171717] lg:flex"
                type="button"
              >
                {mode === 'locked' ? (
                  <PanelLeftClose className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <PanelLeft className="w-4 h-4 flex-shrink-0" />
                )}
              </button>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-3">
          {inSubmodule && (
            <button
              type="button"
              onClick={() => handleNavigate('dashboard')}
              className={`tbo-focus group mx-2 mb-3 flex w-[calc(100%-1rem)] items-center rounded-lg text-left text-sm text-[#525252] transition-colors hover:bg-[#f5f5f5] hover:text-[#171717] ${
                expanded ? 'gap-3 px-3 py-2.5' : 'justify-center px-0 py-2.5'
              }`}
              title={!expanded ? t('sidebar.mainMenu') : undefined}
            >
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md group-hover:bg-white">
                <ArrowLeft className="h-4 w-4" />
              </span>
              {expanded && (
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium leading-5">{t('sidebar.mainMenu')}</span>
                  <span className="block truncate text-xs leading-4 text-[#737373]">{t('sidebar.mainMenu.desc')}</span>
                </span>
              )}
            </button>
          )}

          {navSections.map(section => (
            <div key={section.label || 'top'} className="mb-4 last:mb-0">
              {expanded && section.label ? (
                <p className="mb-1 px-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a3a3a3]">
                  {section.label}
                </p>
              ) : null}
              <div className="space-y-1">
                {section.items.map(item => renderItem(item, forceExpanded))}
              </div>
            </div>
          ))}
        </nav>

        {renderAccountFooter(forceExpanded)}
      </>
    );
  };

  const desktopSidebar = (
    <div
      className={`relative h-full flex-shrink-0 overflow-hidden border-r border-[#e5e5e5] bg-white/95 flex flex-col transition-[width] duration-200 ${
        mode === 'locked' ? 'w-72' : 'w-16'
      }`}
    >
      {renderNavContent(false)}
    </div>
  );

  return (
    <div className="flex flex-col flex-shrink-0 self-stretch min-h-0">
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={onMobileClose}
            aria-label={t('sidebar.closeMenu')}
          />
          <div className="absolute inset-y-0 left-0 z-50 flex w-80 max-w-[88vw] flex-col border-r border-[#e5e5e5] bg-white shadow-[rgba(0,0,0,0.1)_0px_0px_0px_4px]">
            {renderNavContent(true)}
          </div>
        </div>
      )}

      <div className="hidden h-full flex-shrink-0 lg:flex lg:flex-col relative z-40 isolation-isolate">
        {desktopSidebar}
      </div>
    </div>
  );
}
