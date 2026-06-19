import { Megaphone, MessageSquare, BookOpen, Users, UserCheck, TrendingUp, Calendar, GraduationCap, Settings, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

interface SidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
  hasRole: (role: string) => boolean;
  totalUnread: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({ activeView, onNavigate, hasRole, totalUnread, collapsed, onToggleCollapse }: SidebarProps) {
  const universalMenuItems = [
    { id: 'announcements', label: 'Announcements', icon: Megaphone },
    { id: 'messages', label: 'Messages', icon: MessageSquare },
  ];

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BookOpen, roles: ['administrator'] },
    { id: 'curriculum', label: 'Curriculum', icon: BookOpen, roles: ['administrator'] },
    { id: 'users', label: 'Users', icon: Users, roles: ['administrator'] },
    { id: 'my-classes', label: 'My Classes', icon: Calendar, roles: ['teacher', 'translator'] },
    { id: 'mentorship', label: 'Mentorship', icon: UserCheck, roles: ['administrator'] },
    { id: 'mentorship-management', label: 'Mentorship Management', icon: TrendingUp, roles: ['administrator'] },
    { id: 'mentor-dashboard', label: 'Mentor Dashboard', icon: UserCheck, roles: ['mentor'] },
    { id: 'my-course', label: 'My Course', icon: GraduationCap, roles: ['student'] }
  ];

  const visibleMenuItems = menuItems.filter(item =>
    item.roles.some(role => hasRole(role))
  );

  const navButtonClass = (viewId: string) =>
    `w-full flex items-center text-left text-sm font-medium transition-colors ${
      collapsed ? 'justify-center px-0 py-3' : 'px-6 py-3'
    } ${
      activeView === viewId
        ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
    }`;

  return (
    <div
      className={`h-full flex-shrink-0 overflow-hidden bg-gray-50 border-r border-gray-200 flex flex-col transition-all duration-200 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      <div className={`flex-shrink-0 border-b border-gray-200 ${collapsed ? 'py-3' : 'py-2 px-3'}`}>
        <button
          onClick={onToggleCollapse}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={`w-full flex items-center text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors ${
            collapsed ? 'justify-center py-1' : 'justify-end px-2 py-1.5'
          }`}
        >
          {collapsed ? (
            <PanelLeftOpen className="w-4 h-4" />
          ) : (
            <PanelLeftClose className="w-4 h-4" />
          )}
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto py-4">
        {universalMenuItems.map(item => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={navButtonClass(item.id)}
            title={collapsed ? item.label : undefined}
          >
            <span className={collapsed ? 'relative' : 'contents'}>
              <item.icon className={`w-4 h-4 ${collapsed ? '' : 'mr-3'}`} />
              {collapsed && item.id === 'messages' && totalUnread > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[0.875rem] h-3.5 px-0.5 flex items-center justify-center rounded-full bg-amber-600 text-white text-[10px] font-medium leading-none">
                  {totalUnread > 9 ? '9+' : totalUnread}
                </span>
              )}
            </span>
            {!collapsed && (
              <>
                <span className="flex-1">{item.label}</span>
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
            title={collapsed ? item.label : undefined}
          >
            <item.icon className={`w-4 h-4 ${collapsed ? '' : 'mr-3'}`} />
            {!collapsed && item.label}
          </button>
        ))}
      </nav>
      <div className="border-t border-gray-200">
        <button
          onClick={() => onNavigate('settings')}
          className={navButtonClass('settings')}
          title={collapsed ? 'Settings' : undefined}
        >
          <Settings className={`w-4 h-4 ${collapsed ? '' : 'mr-3'}`} />
          {!collapsed && 'Settings'}
        </button>
      </div>
    </div>
  );
}
