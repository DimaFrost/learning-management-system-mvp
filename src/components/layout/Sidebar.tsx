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
  BarChart2,
  Shield,
  X,
  Sparkles,
  Languages,
  Clock3,
} from 'lucide-react';

interface SidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
  hasRole: (role: string) => boolean;
  totalUnread: number;
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

const attendanceItems: NavItem[] = [
  {
    id: 'attendance-overview',
    label: 'Overview',
    description: 'Student standing',
    icon: ClipboardList,
    roles: ['administrator'],
    workspaces: ['administrator'],
  },
  {
    id: 'attendance-sunday',
    label: 'Sunday Attendance',
    description: 'Monthly service',
    icon: Calendar,
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
    id: 'attendance-settings',
    label: 'Settings',
    description: 'Rules and weights',
    icon: Settings,
    roles: ['administrator'],
    workspaces: ['administrator'],
  },
];

export function Sidebar({
  activeView,
  onNavigate,
  hasRole,
  totalUnread,
  isOnDuty,
  activeWorkspace,
  mode,
  onToggleMode,
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const isExpanded = mode === 'locked';

  useEffect(() => {
    if (!mobileOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onMobileClose?.();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [mobileOpen, onMobileClose]);

  const sections: NavSection[] = [
    {
      label: 'School',
      items: [
        {
          id: 'dashboard',
          label: 'Dashboard',
          description: 'Overview',
          icon: LayoutDashboard,
          roles: ['administrator'],
          workspaces: ['administrator'],
        },
        {
          id: 'announcements',
          label: 'Announcements',
          description: 'Posts and notices',
          icon: Megaphone,
          shared: true,
        },
        {
          id: 'messages',
          label: 'Messages',
          description: 'Conversations',
          icon: MessageSquare,
          shared: true,
          badge: totalUnread > 0 ? (totalUnread > 9 ? '9+' : String(totalUnread)) : undefined,
        },
      ],
    },
    {
      label: 'Operations',
      items: [
        {
          id: 'curriculum',
          label: 'Curriculum',
          description: 'Courses and sessions',
          icon: BookOpen,
          roles: ['administrator'],
          workspaces: ['administrator'],
        },
        {
          id: 'users',
          label: 'Users',
          description: 'People and roles',
          icon: Users,
          roles: ['administrator'],
          workspaces: ['administrator'],
        },
        {
          id: 'attendance-overview',
          label: 'Attendance',
          description: 'Presence and duty',
          icon: ClipboardList,
          roles: ['administrator'],
          workspaces: ['administrator'],
        },
        {
          id: 'mentorship',
          label: 'Mentorship',
          description: 'Assignments',
          icon: UserCheck,
          roles: ['administrator'],
          workspaces: ['administrator'],
        },
        {
          id: 'mentorship-management',
          label: 'Mentor Ops',
          description: 'Cadence and logs',
          icon: TrendingUp,
          roles: ['administrator'],
          workspaces: ['administrator'],
        },
      ],
    },
    {
      label: 'My Work',
      items: [
        {
          id: 'my-classes',
          label: 'My Sessions',
          description: 'Teaching schedule',
          icon: Calendar,
          roles: ['teacher'],
          workspaces: ['teacher'],
        },
        {
          id: 'my-classes',
          label: 'Translation Desk',
          description: 'Session support',
          icon: Languages,
          roles: ['translator'],
          workspaces: ['translator'],
        },
        {
          id: 'mentor-dashboard',
          label: 'Mentor Dashboard',
          description: 'Students',
          icon: UserCheck,
          roles: ['mentor'],
          workspaces: ['mentor'],
        },
        {
          id: 'my-course',
          label: 'My Course',
          description: 'Student view',
          icon: GraduationCap,
          roles: ['student'],
          workspaces: ['student'],
        },
        {
          id: 'on-duty',
          label: 'On Duty',
          description: 'This week',
          icon: Shield,
          badge: 'Live',
          tone: 'alert',
          roles: isOnDuty ? undefined : ['__hidden__'],
          shared: true,
        },
        {
          id: 'my-attendance',
          label: 'My Attendance',
          description: 'Personal record',
          icon: BarChart2,
          shared: true,
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
  const inAttendanceModule =
    activeView === 'attendance' ||
    activeView.startsWith('attendance-');

  const handleNavigate = (viewId: string) => {
    onNavigate(viewId);
    onMobileClose?.();
  };

  const toggleTitle = mode === 'locked' ? 'Collapse sidebar' : 'Expand sidebar';
  const workspaceLabel = activeWorkspace ? WORKSPACE_LABELS[activeWorkspace] : 'Workspace';

  const renderItem = (item: NavItem, forceExpanded: boolean) => {
    const expanded = forceExpanded || isExpanded;
    const active = activeView === item.id || (item.id === 'attendance-overview' && activeView === 'attendance');
    const alert = item.tone === 'alert';
    const Icon = item.icon;

    return (
      <button
        key={`${item.id}-${item.label}`}
        type="button"
        onClick={() => handleNavigate(item.id)}
        className={`tbo-focus group mx-2 flex w-[calc(100%-1rem)] items-center rounded-xl text-left text-sm transition-colors ${
          expanded ? 'gap-3 px-3 py-2.5' : 'justify-center px-0 py-2.5'
        } ${
          active
            ? alert
              ? 'bg-[#fff6f0] text-[#d97757]'
              : 'bg-[#efeeeb] text-[#121212]'
            : alert
              ? 'text-[#d97757] hover:bg-[#fff6f0]'
              : 'text-[#373734] hover:bg-[#efeeeb] hover:text-[#121212]'
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
            <span className="absolute -right-1 -top-1 h-2.5 min-w-2.5 rounded-full bg-[#d97757] ring-2 ring-white" />
          )}
        </span>
        {expanded && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium leading-5">{item.label}</span>
              {item.description && (
                <span className="block truncate text-xs leading-4 text-[#7b7974]">{item.description}</span>
              )}
            </span>
            {item.badge && (
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  alert ? 'bg-white text-[#d97757]' : 'bg-white text-[#121212]'
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
    const navSections = inAttendanceModule && visibleAttendanceItems.length > 0
      ? [{ label: 'Attendance', items: visibleAttendanceItems }]
      : visibleSections;

    return (
      <>
        <div
          className={`flex-shrink-0 border-b border-[#e7e6e1] py-3 ${
            forceExpanded ? 'px-4' : 'px-2'
          }`}
        >
          {forceExpanded ? (
            <div className="flex items-center justify-between">
              <div>
                <span className="font-serif text-xl font-normal text-[#121212]">Menu</span>
                <p className="text-xs text-[#7b7974]">School workspace</p>
              </div>
              <button
                type="button"
                onClick={onMobileClose}
                className="tbo-focus rounded-lg p-2 text-[#7b7974] hover:bg-[#efeeeb] hover:text-[#121212]"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className={`flex items-center ${expanded ? 'justify-between pl-2' : 'justify-center'}`}>
              {expanded && (
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold uppercase tracking-[0.18em] text-[#7b7974]">
                    {inAttendanceModule ? 'Module' : 'Workspace'}
                  </p>
                  <p className="truncate font-serif text-lg font-normal leading-tight text-[#121212]">
                    {inAttendanceModule ? 'Attendance' : workspaceLabel}
                  </p>
                </div>
              )}
              <button
                onClick={onToggleMode}
                title={toggleTitle}
                className="tbo-focus hidden rounded-lg p-1.5 text-sm text-[#7b7974] transition-colors hover:bg-[#efeeeb] hover:text-[#121212] lg:flex"
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
          {inAttendanceModule && (
            <button
              type="button"
              onClick={() => handleNavigate('dashboard')}
              className={`tbo-focus group mx-2 mb-3 flex w-[calc(100%-1rem)] items-center rounded-xl text-left text-sm text-[#373734] transition-colors hover:bg-[#efeeeb] hover:text-[#121212] ${
                expanded ? 'gap-3 px-3 py-2.5' : 'justify-center px-0 py-2.5'
              }`}
              title={!expanded ? 'Main menu' : undefined}
            >
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md group-hover:bg-white">
                <ArrowLeft className="h-4 w-4" />
              </span>
              {expanded && (
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium leading-5">Main menu</span>
                  <span className="block truncate text-xs leading-4 text-[#7b7974]">Back to primary sidebar</span>
                </span>
              )}
            </button>
          )}

          {navSections.map(section => (
            <div key={section.label} className="mb-4 last:mb-0">
              {expanded && (
                <p className="mb-1 px-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9c9a92]">
                  {section.label}
                </p>
              )}
              <div className="space-y-1">
                {section.items.map(item => renderItem(item, forceExpanded))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-[#e7e6e1] p-2">
          {renderItem(
            {
              id: 'settings',
              label: 'Settings',
              description: 'Profile and account',
              icon: Settings,
              shared: true,
            },
            forceExpanded
          )}
          {expanded && (
            <div className="mx-2 mt-2 rounded-2xl border border-[#e7e6e1] bg-[#efeeeb] p-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[#121212]">
                  {inAttendanceModule ? <Clock3 className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-[#121212]">
                    {inAttendanceModule ? 'Attendance module' : `${workspaceLabel} view`}
                  </p>
                  <p className="truncate text-[11px] text-[#7b7974]">
                    {inAttendanceModule ? 'Presence and duty' : 'Live school data'}
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
      className={`relative h-full flex-shrink-0 overflow-hidden border-r border-[#e7e6e1] bg-[#f8f8f6]/95 flex flex-col transition-[width] duration-200 ${
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
            className="absolute inset-0 bg-[#121212]/40"
            onClick={onMobileClose}
            aria-label="Close menu"
          />
          <div className="absolute inset-y-0 left-0 z-50 flex w-80 max-w-[88vw] flex-col border-r border-[#e7e6e1] bg-[#f8f8f6] shadow-[rgba(18,18,18,0.12)_0px_0px_0px_4px]">
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
