import { useEffect } from 'react';
import type { WorkspaceId } from '../../types/workspace';
import { WORKSPACE_LABELS } from '../../types/workspace';
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
  X,
  Sparkles,
  Languages,
  Clock3,
  Activity,
  ShieldCheck,
  HeartHandshake,
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

interface SidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
  hasRole: (role: string) => boolean;
  totalUnread: number;
  announcementDraftCount: number;
  todoTodayCount: number;
  pendingUserCount?: number;
  isOnDuty: boolean;
  activeWorkspace: WorkspaceId | null;
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
};

type NavSection = {
  label: string;
  items: NavItem[];
};

export function Sidebar({
  activeView,
  onNavigate,
  hasRole,
  totalUnread,
  announcementDraftCount,
  todoTodayCount,
  pendingUserCount = 0,
  isOnDuty,
  activeWorkspace,
  mode,
  onToggleMode,
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const isExpanded = mode === 'locked';
  const { t } = useLanguage();

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
      label: 'Overview',
      description: 'Graduation gates',
      icon: ClipboardList,
      roles: ['administrator'],
      workspaces: ['administrator'],
    },
    {
      id: 'attendance-classes',
      label: 'Classes',
      description: 'Weekly sessions',
      icon: Calendar,
      roles: ['administrator'],
      workspaces: ['administrator'],
    },
    {
      id: 'attendance-well',
      label: 'The Well',
      description: 'Wednesday attendance',
      icon: Activity,
      roles: ['administrator'],
      workspaces: ['administrator'],
    },
    {
      id: 'attendance-ministry',
      label: 'Ministry',
      description: 'Teams and service',
      icon: UserCheck,
      roles: ['administrator'],
      workspaces: ['administrator'],
    },
    {
      id: 'attendance-activation',
      label: 'Activation Saturday',
      description: 'Monthly joint sessions',
      icon: ShieldCheck,
      roles: ['administrator'],
      workspaces: ['administrator'],
    },
    {
      id: 'attendance-duty',
      label: 'On Duty Schedule',
      description: 'Attendance keepers',
      icon: Users,
      roles: ['administrator'],
      workspaces: ['administrator'],
    },
    {
      id: 'attendance-prayer',
      label: 'Prayer Schedule',
      description: 'Tuesday & Thursday prayer',
      icon: HeartHandshake,
      roles: ['administrator'],
      workspaces: ['administrator'],
    },
    {
      id: 'attendance-settings',
      label: t('sidebar.settings'),
      description: 'Rules and weights',
      icon: Settings,
      roles: ['administrator'],
      workspaces: ['administrator'],
    },
  ];

  const curriculumItems: NavItem[] = [
    {
      id: 'curriculum-overview',
      label: 'Overview',
      description: 'Year groups and subjects',
      icon: BookOpen,
      roles: ['administrator'],
      workspaces: ['administrator'],
    },
    {
      id: 'curriculum-date-view',
      label: 'Date View',
      description: 'Sessions by date',
      icon: Calendar,
      roles: ['administrator'],
      workspaces: ['administrator'],
    },
    {
      id: 'curriculum-planning',
      label: 'Planning',
      description: 'Classes and Activation',
      icon: Calendar,
      roles: ['administrator'],
      workspaces: ['administrator'],
    },
    {
      id: 'curriculum-books',
      label: 'Books',
      description: 'Reading assignments',
      icon: BookOpen,
      roles: ['administrator'],
      workspaces: ['administrator'],
    },
    {
      id: 'curriculum-archived',
      label: 'Archived',
      description: 'Inactive year groups',
      icon: Clock3,
      roles: ['administrator'],
      workspaces: ['administrator'],
    },
  ];


  const myAttendanceItems: NavItem[] = [
    {
      id: 'my-attendance-overview',
      label: 'Attendance overall',
      description: 'Graduation gates & scores',
      icon: BarChart2,
      roles: ['student'],
      workspaces: ['student'],
    },
    {
      id: 'my-attendance-breakdown',
      label: 'Session history',
      description: 'Dates, status & views',
      icon: Calendar,
      roles: ['student'],
      workspaces: ['student'],
    },
    {
      id: 'my-attendance-ministry',
      label: 'Ministry',
      description: 'Team leaders & contacts',
      icon: HeartHandshake,
      roles: ['student'],
      workspaces: ['student'],
    },
  ];

  const usersItems: NavItem[] = [
    {
      id: 'users-directory',
      label: 'Directory',
      description: 'Search & manage people',
      icon: Users,
      roles: ['administrator'],
      workspaces: ['administrator'],
      badge: pendingUserCount > 0 ? (pendingUserCount > 9 ? '9+' : String(pendingUserCount)) : undefined,
    },
    {
      id: 'users-pending',
      label: 'Pending access',
      description: 'Awaiting role assignment',
      icon: Clock3,
      roles: ['administrator'],
      workspaces: ['administrator'],
      badge: pendingUserCount > 0 ? (pendingUserCount > 9 ? '9+' : String(pendingUserCount)) : undefined,
      tone: pendingUserCount > 0 ? 'alert' : 'default',
    },
    {
      id: 'users-enrollments',
      label: 'Enrollments',
      description: 'Student × course × mentor',
      icon: GraduationCap,
      roles: ['administrator'],
      workspaces: ['administrator'],
    },
    {
      id: 'users-staff',
      label: 'Staff roster',
      description: 'Teachers, mentors & leaders',
      icon: UserCheck,
      roles: ['administrator'],
      workspaces: ['administrator'],
    },
  ];

  const mentorshipItems: NavItem[] = [
    {
      id: 'mentorship-overview',
      label: 'Overview',
      description: 'Health & coverage',
      icon: Activity,
      roles: ['administrator'],
      workspaces: ['administrator'],
    },
    {
      id: 'mentorship-assignments',
      label: 'Assignments',
      description: 'Student-mentor pairs',
      icon: UserCheck,
      roles: ['administrator'],
      workspaces: ['administrator'],
    },
    {
      id: 'mentorship-follow-up',
      label: 'Follow-up',
      description: 'Risk monitoring',
      icon: TrendingUp,
      roles: ['administrator'],
      workspaces: ['administrator'],
    },
    {
      id: 'mentorship-check-in-rules',
      label: 'Check-in rules',
      description: 'In-person meeting expectations',
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
          id: 'classwork',
          label: 'Classwork',
          description: 'Assignments and materials',
          icon: BookOpen,
          roles: ['administrator', 'teacher'],
          workspaces: ['administrator', 'teacher'],
        },
        {
          id: 'grades',
          label: 'Grades',
          description: 'Academic record',
          icon: BarChart2,
          roles: ['administrator', 'teacher'],
          workspaces: ['administrator', 'teacher'],
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
          roles: ['administrator'],
          workspaces: ['administrator'],
        },
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
      label: t('sidebar.myWork'),
      items: [
        {
          id: 'my-classes',
          label: t('sidebar.mySessions'),
          description: t('sidebar.mySessions.desc'),
          icon: Calendar,
          roles: ['teacher'],
          workspaces: ['teacher'],
        },
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
          label: 'Ministry Report',
          description: 'Team attendance',
          icon: ClipboardList,
          roles: ['team_leader'],
          workspaces: ['team_leader'],
        },
        {
          id: 'my-classwork',
          label: 'My Classwork',
          description: 'Homework and materials',
          icon: GraduationCap,
          roles: ['student'],
          workspaces: ['student'],
        },
        {
          id: 'my-grades',
          label: 'My Grades',
          description: 'Academic record',
          icon: BarChart2,
          roles: ['student'],
          workspaces: ['student'],
        },
        {
          id: 'my-books',
          label: 'My books',
          description: 'Reading assignments',
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

  const visibleSections = sections
    .map(section => ({
      ...section,
      items: section.items.filter(item => {
        const hasPermission = !item.roles || item.roles.some(role => hasRole(role));
        const fitsWorkspace =
          item.shared ||
          !item.workspaces ||
          !activeWorkspace ||
          item.workspaces.includes(activeWorkspace);

        return hasPermission && fitsWorkspace;
      }),
    }))
    .filter(section => section.items.length > 0);

  const visibleAttendanceItems = attendanceItems.filter(item => {
    const hasPermission = !item.roles || item.roles.some(role => hasRole(role));
    const fitsWorkspace =
      item.shared ||
      !item.workspaces ||
      !activeWorkspace ||
      item.workspaces.includes(activeWorkspace);

    return hasPermission && fitsWorkspace;
  });
  const visibleCurriculumItems = curriculumItems.filter(item => {
    const hasPermission = !item.roles || item.roles.some(role => hasRole(role));
    const fitsWorkspace =
      item.shared ||
      !item.workspaces ||
      !activeWorkspace ||
      item.workspaces.includes(activeWorkspace);

    return hasPermission && fitsWorkspace;
  });
  const visibleMentorshipItems = mentorshipItems.filter(item => {
    const hasPermission = !item.roles || item.roles.some(role => hasRole(role));
    const fitsWorkspace =
      item.shared ||
      !item.workspaces ||
      !activeWorkspace ||
      item.workspaces.includes(activeWorkspace);

    return hasPermission && fitsWorkspace;
  });
  const visibleMyAttendanceItems = myAttendanceItems.filter(item => {
    const hasPermission = !item.roles || item.roles.some(role => hasRole(role));
    const fitsWorkspace =
      item.shared ||
      !item.workspaces ||
      !activeWorkspace ||
      item.workspaces.includes(activeWorkspace);

    return hasPermission && fitsWorkspace;
  });
  const visibleUsersItems = usersItems.filter(item => {
    const hasPermission = !item.roles || item.roles.some(role => hasRole(role));
    const fitsWorkspace =
      item.shared ||
      !item.workspaces ||
      !activeWorkspace ||
      item.workspaces.includes(activeWorkspace);

    return hasPermission && fitsWorkspace;
  });
  const inAttendanceModule =
    activeView === 'attendance' ||
    activeView.startsWith('attendance-');
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
  const inSubmodule = inAttendanceModule || inCurriculumModule || inMentorshipModule || inMyAttendanceModule || inUsersModule;
  const workspaceLabel = activeWorkspace ? WORKSPACE_LABELS[activeWorkspace] : t('sidebar.workspace');
  const submoduleLabel = inAttendanceModule
    ? t('sidebar.attendance')
    : inCurriculumModule
      ? t('sidebar.curriculum')
      : inMentorshipModule
        ? t('sidebar.mentorship')
        : inMyAttendanceModule
          ? t('sidebar.myAttendance')
          : inUsersModule
            ? t('sidebar.users')
            : workspaceLabel;
  const submoduleDesc = inAttendanceModule
    ? t('sidebar.attendance.desc')
    : inCurriculumModule
      ? t('sidebar.curriculum.desc')
      : inMentorshipModule
        ? t('sidebar.mentorship.desc')
        : inMyAttendanceModule
          ? t('sidebar.myAttendance.desc')
          : inUsersModule
            ? t('sidebar.users.desc')
            : 'Live school data';

  const handleNavigate = (viewId: string) => {
    onNavigate(viewId);
    onMobileClose?.();
  };

  const toggleTitle = mode === 'locked' ? 'Collapse sidebar' : 'Expand sidebar';

  const renderItem = (item: NavItem, forceExpanded: boolean) => {
    const expanded = forceExpanded || isExpanded;
    const active =
      activeView === item.id ||
      (item.id === 'curriculum-overview' && activeView === 'curriculum') ||
      (item.id === 'attendance-overview' && activeView === 'attendance') ||
      (item.id === 'my-attendance-overview' && (activeView === 'my-attendance' || activeView === 'my-attendance-overview')) ||
      (item.id === 'users-directory' && (activeView === 'users' || activeView === 'users-directory')) ||
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

  const renderNavContent = (forceExpanded: boolean) => {
    const expanded = forceExpanded || isExpanded;
    const attendanceGroupIds = new Set([
      'attendance-overview',
      'attendance-classes',
      'attendance-well',
      'attendance-ministry',
      'attendance-activation',
    ]);
    const navSections = inAttendanceModule && visibleAttendanceItems.length > 0
      ? [
          {
            label: 'Attendance Groups',
            items: visibleAttendanceItems.filter(item => attendanceGroupIds.has(item.id)),
          },
          {
            label: 'Operations',
            items: visibleAttendanceItems.filter(item => !attendanceGroupIds.has(item.id)),
          },
        ].filter(section => section.items.length > 0)
      : inCurriculumModule && visibleCurriculumItems.length > 0
        ? [
            {
              label: 'Curriculum',
              items: visibleCurriculumItems,
            },
          ]
      : inMentorshipModule && visibleMentorshipItems.length > 0
        ? [
            {
              label: 'Mentorship',
              items: visibleMentorshipItems,
            },
          ]
        : inMyAttendanceModule && visibleMyAttendanceItems.length > 0
          ? [
              {
                label: 'My Attendance',
                items: visibleMyAttendanceItems,
              },
            ]
          : inUsersModule && visibleUsersItems.length > 0
            ? [
                {
                  label: 'People',
                  items: visibleUsersItems,
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
                aria-label="Close menu"
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

        <div className="border-t border-[#e5e5e5] p-2">
          {renderItem(
            {
              id: 'settings',
              label: t('sidebar.settings'),
              description: t('sidebar.settings.desc'),
              icon: Settings,
              shared: true,
            },
            forceExpanded
          )}
          {expanded && (
            <div className="mx-2 mt-2 rounded-xl border border-[#e5e5e5] bg-[#f5f5f5] p-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[#2563eb]">
                  {inSubmodule ? <Clock3 className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-[#171717]">
                  {inSubmodule ? `${submoduleLabel} ${t('sidebar.module').toLowerCase()}` : `${workspaceLabel} view`}
                  </p>
                  <p className="truncate text-[11px] text-[#737373]">
                    {inSubmodule ? submoduleDesc : 'Live school data'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
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
            aria-label="Close menu"
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
