import { useEffect, useState } from 'react';
import {
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
} from 'lucide-react';

interface SidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
  hasRole: (role: string) => boolean;
  totalUnread: number;
  isOnDuty: boolean;
  mode: 'locked' | 'auto-hide';
  onToggleMode: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({
  activeView,
  onNavigate,
  hasRole,
  totalUnread,
  isOnDuty,
  mode,
  onToggleMode,
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const [isHovering, setIsHovering] = useState(false);
  const isExpanded = mode === 'locked' || isHovering;

  useEffect(() => {
    if (!mobileOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onMobileClose?.();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [mobileOpen, onMobileClose]);

  const universalMenuItems = [
    { id: 'announcements', label: 'Announcements', icon: Megaphone },
    { id: 'messages', label: 'Messages', icon: MessageSquare },
  ];

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['administrator'] },
    { id: 'curriculum', label: 'Curriculum', icon: BookOpen, roles: ['administrator'] },
    { id: 'users', label: 'Users', icon: Users, roles: ['administrator'] },
    { id: 'my-classes', label: 'My Classes', icon: Calendar, roles: ['teacher', 'translator'] },
    { id: 'mentorship', label: 'Mentorship', icon: UserCheck, roles: ['administrator'] },
    { id: 'mentorship-management', label: 'Mentorship Management', icon: TrendingUp, roles: ['administrator'] },
    { id: 'attendance', label: 'Attendance', icon: ClipboardList, roles: ['administrator'] },
    { id: 'mentor-dashboard', label: 'Mentor Dashboard', icon: UserCheck, roles: ['mentor'] },
    { id: 'my-course', label: 'My Course', icon: GraduationCap, roles: ['student'] },
  ];

  const visibleMenuItems = menuItems.filter(item =>
    item.roles.some(role => hasRole(role))
  );

  const handleNavigate = (viewId: string) => {
    onNavigate(viewId);
    onMobileClose?.();
  };

  const navButtonClass = (viewId: string, forceExpanded = false) => {
    const expanded = forceExpanded || isExpanded;
    return `w-full flex items-center text-left text-sm font-medium transition-colors ${
      expanded ? 'px-6 py-3' : 'justify-center px-0 py-3'
    } ${
      activeView === viewId
        ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
    }`;
  };

  const onDutyButtonClass = (forceExpanded = false) => {
    const expanded = forceExpanded || isExpanded;
    return `w-full flex items-center text-left text-sm font-medium transition-colors ${
      expanded ? 'px-6 py-3' : 'justify-center px-0 py-3'
    } ${
      activeView === 'on-duty'
        ? 'bg-amber-50 text-amber-800 border-r-2 border-amber-500'
        : 'text-amber-800 hover:bg-amber-50'
    }`;
  };

  const toggleTitle =
    mode === 'locked'
      ? 'Switch to auto-hide — sidebar will collapse and expand on hover'
      : 'Pin sidebar — keep it always expanded';

  const renderNavContent = (forceExpanded: boolean) => (
    <>
      <div
        className={`flex-shrink-0 border-b border-gray-200 py-3 ${
          forceExpanded ? 'px-4 flex items-center justify-between' : isExpanded ? 'pr-6' : 'pr-2'
        }`}
      >
        {forceExpanded ? (
          <>
            <span className="text-sm font-semibold text-gray-900">Menu</span>
            <button
              type="button"
              onClick={onMobileClose}
              className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </>
        ) : (
          <button
            onClick={onToggleMode}
            title={toggleTitle}
            className="hidden lg:flex w-full items-center justify-end text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors p-1.5"
          >
            {mode === 'locked' ? (
              <PanelLeftClose className="w-4 h-4 flex-shrink-0" />
            ) : (
              <PanelLeft className="w-4 h-4 flex-shrink-0" />
            )}
          </button>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto py-4">
        {universalMenuItems.map(item => (
          <button
            key={item.id}
            onClick={() => handleNavigate(item.id)}
            className={navButtonClass(item.id, forceExpanded)}
            title={!forceExpanded && !isExpanded ? item.label : undefined}
          >
            <span className={forceExpanded || isExpanded ? 'contents' : 'relative'}>
              <item.icon
                className={`w-4 h-4 flex-shrink-0 ${forceExpanded || isExpanded ? 'mr-3' : ''}`}
              />
              {!forceExpanded && !isExpanded && item.id === 'messages' && totalUnread > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[0.875rem] h-3.5 px-0.5 flex items-center justify-center rounded-full bg-amber-600 text-white text-[10px] font-medium leading-none">
                  {totalUnread > 9 ? '9+' : totalUnread}
                </span>
              )}
            </span>
            {(forceExpanded || isExpanded) && (
              <>
                <span className="flex-1 whitespace-nowrap">{item.label}</span>
                {item.id === 'messages' && totalUnread > 0 && (
                  <span className="min-w-[1.25rem] h-5 px-1.5 flex items-center justify-center rounded-full bg-amber-600 text-white text-xs font-medium">
                    {totalUnread > 9 ? '9+' : totalUnread}
                  </span>
                )}
              </>
            )}
          </button>
        ))}
        {visibleMenuItems.map(item => (
          <button
            key={item.id}
            onClick={() => handleNavigate(item.id)}
            className={navButtonClass(item.id, forceExpanded)}
            title={!forceExpanded && !isExpanded ? item.label : undefined}
          >
            <item.icon
              className={`w-4 h-4 flex-shrink-0 ${forceExpanded || isExpanded ? 'mr-3' : ''}`}
            />
            {(forceExpanded || isExpanded) && (
              <span className="whitespace-nowrap">{item.label}</span>
            )}
          </button>
        ))}
        {isOnDuty && (
          <button
            onClick={() => handleNavigate('on-duty')}
            className={onDutyButtonClass(forceExpanded)}
            title={!forceExpanded && !isExpanded ? 'On Duty' : undefined}
          >
            <span className={forceExpanded || isExpanded ? 'contents' : 'relative'}>
              <Shield
                className={`w-4 h-4 flex-shrink-0 ${forceExpanded || isExpanded ? 'mr-3' : ''}`}
              />
              {!forceExpanded && !isExpanded && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              )}
            </span>
            {(forceExpanded || isExpanded) && (
              <>
                <span className="flex-1 whitespace-nowrap">On Duty 🎓</span>
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
              </>
            )}
          </button>
        )}
      </nav>
      <div className="border-t border-gray-200">
        <button
          onClick={() => handleNavigate('my-attendance')}
          className={navButtonClass('my-attendance', forceExpanded)}
          title={!forceExpanded && !isExpanded ? 'My Attendance' : undefined}
        >
          <BarChart2
            className={`w-4 h-4 flex-shrink-0 ${forceExpanded || isExpanded ? 'mr-3' : ''}`}
          />
          {(forceExpanded || isExpanded) && (
            <span className="whitespace-nowrap">My Attendance</span>
          )}
        </button>
        <button
          onClick={() => handleNavigate('settings')}
          className={navButtonClass('settings', forceExpanded)}
          title={!forceExpanded && !isExpanded ? 'Settings' : undefined}
        >
          <Settings
            className={`w-4 h-4 flex-shrink-0 ${forceExpanded || isExpanded ? 'mr-3' : ''}`}
          />
          {(forceExpanded || isExpanded) && (
            <span className="whitespace-nowrap">Settings</span>
          )}
        </button>
      </div>
    </>
  );

  const desktopSidebar =
    mode === 'locked' ? (
      <div className="relative w-64 h-full flex-shrink-0 overflow-hidden bg-gray-50 border-r border-gray-200 flex flex-col">
        {renderNavContent(false)}
      </div>
    ) : (
      <div className="relative w-16 flex-shrink-0 h-full">
        <div
          className={`absolute left-0 top-0 h-full flex flex-col overflow-hidden bg-gray-50 border-r border-gray-200 transition-[width,box-shadow] duration-200 ${
            isHovering ? 'w-64 shadow-xl z-30' : 'w-16'
          }`}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
        >
          {renderNavContent(false)}
        </div>
      </div>
    );

  return (
    <>
      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            onClick={onMobileClose}
            aria-label="Close menu"
          />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] flex flex-col bg-gray-50 border-r border-gray-200 shadow-xl z-50">
            {renderNavContent(true)}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:block h-full flex-shrink-0">{desktopSidebar}</div>
    </>
  );
}
