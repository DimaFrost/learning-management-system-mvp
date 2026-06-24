import { useState } from 'react';
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
} from 'lucide-react';

interface SidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
  hasRole: (role: string) => boolean;
  totalUnread: number;
  isOnDuty: boolean;
  mode: 'locked' | 'auto-hide';
  onToggleMode: () => void;
}

export function Sidebar({
  activeView,
  onNavigate,
  hasRole,
  totalUnread,
  isOnDuty,
  mode,
  onToggleMode,
}: SidebarProps) {
  const [isHovering, setIsHovering] = useState(false);
  const isExpanded = mode === 'locked' || isHovering;

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

  const navButtonClass = (viewId: string) =>
    `w-full flex items-center text-left text-sm font-medium transition-colors ${
      isExpanded ? 'px-6 py-3' : 'justify-center px-0 py-3'
    } ${
      activeView === viewId
        ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
    }`;

  const onDutyButtonClass =
    `w-full flex items-center text-left text-sm font-medium transition-colors ${
      isExpanded ? 'px-6 py-3' : 'justify-center px-0 py-3'
    } ${
      activeView === 'on-duty'
        ? 'bg-amber-50 text-amber-800 border-r-2 border-amber-500'
        : 'text-amber-800 hover:bg-amber-50'
    }`;

  const toggleTitle =
    mode === 'locked'
      ? 'Switch to auto-hide — sidebar will collapse and expand on hover'
      : 'Pin sidebar — keep it always expanded';

  const sidebarContent = (
    <>
      <div className={`flex-shrink-0 border-b border-gray-200 py-3 ${isExpanded ? 'pr-6' : 'pr-2'}`}>
        <button
          onClick={onToggleMode}
          title={toggleTitle}
          className="w-full flex items-center justify-end text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors p-1.5"
        >
          {mode === 'locked' ? (
            <PanelLeftClose className="w-4 h-4 flex-shrink-0" />
          ) : (
            <PanelLeft className="w-4 h-4 flex-shrink-0" />
          )}
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto py-4">
        {universalMenuItems.map(item => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={navButtonClass(item.id)}
            title={!isExpanded ? item.label : undefined}
          >
            <span className={isExpanded ? 'contents' : 'relative'}>
              <item.icon className={`w-4 h-4 flex-shrink-0 ${isExpanded ? 'mr-3' : ''}`} />
              {!isExpanded && item.id === 'messages' && totalUnread > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[0.875rem] h-3.5 px-0.5 flex items-center justify-center rounded-full bg-amber-600 text-white text-[10px] font-medium leading-none">
                  {totalUnread > 9 ? '9+' : totalUnread}
                </span>
              )}
            </span>
            {isExpanded && (
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
            onClick={() => onNavigate(item.id)}
            className={navButtonClass(item.id)}
            title={!isExpanded ? item.label : undefined}
          >
            <item.icon className={`w-4 h-4 flex-shrink-0 ${isExpanded ? 'mr-3' : ''}`} />
            {isExpanded && <span className="whitespace-nowrap">{item.label}</span>}
          </button>
        ))}
        {isOnDuty && (
          <button
            onClick={() => onNavigate('on-duty')}
            className={onDutyButtonClass}
            title={!isExpanded ? 'On Duty' : undefined}
          >
            <span className={isExpanded ? 'contents' : 'relative'}>
              <Shield className={`w-4 h-4 flex-shrink-0 ${isExpanded ? 'mr-3' : ''}`} />
              {!isExpanded && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              )}
            </span>
            {isExpanded && (
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
          onClick={() => onNavigate('my-attendance')}
          className={navButtonClass('my-attendance')}
          title={!isExpanded ? 'My Attendance' : undefined}
        >
          <BarChart2 className={`w-4 h-4 flex-shrink-0 ${isExpanded ? 'mr-3' : ''}`} />
          {isExpanded && <span className="whitespace-nowrap">My Attendance</span>}
        </button>
        <button
          onClick={() => onNavigate('settings')}
          className={navButtonClass('settings')}
          title={!isExpanded ? 'Settings' : undefined}
        >
          <Settings className={`w-4 h-4 flex-shrink-0 ${isExpanded ? 'mr-3' : ''}`} />
          {isExpanded && <span className="whitespace-nowrap">Settings</span>}
        </button>
      </div>
    </>
  );

  if (mode === 'locked') {
    return (
      <div className="relative w-64 h-full flex-shrink-0 overflow-hidden bg-gray-50 border-r border-gray-200 flex flex-col">
        {sidebarContent}
      </div>
    );
  }

  return (
    <div className="relative w-16 flex-shrink-0 h-full">
      <div
        className={`absolute left-0 top-0 h-full flex flex-col overflow-hidden bg-gray-50 border-r border-gray-200 transition-[width,box-shadow] duration-200 ${
          isHovering ? 'w-64 shadow-xl z-30' : 'w-16'
        }`}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {sidebarContent}
      </div>
    </div>
  );
}
