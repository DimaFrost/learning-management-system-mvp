import { Megaphone, MessageSquare, BookOpen, Users, UserCheck, TrendingUp, Calendar, GraduationCap, Settings } from 'lucide-react';

interface SidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
  hasRole: (role: string) => boolean;
  totalUnread: number;
}

export function Sidebar({ activeView, onNavigate, hasRole, totalUnread }: SidebarProps) {
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

  // Filter menu items based on user's roles
  const visibleMenuItems = menuItems.filter(item => 
    item.roles.some(role => hasRole(role))
  );

  const navButtonClass = (viewId: string) =>
    `w-full flex items-center px-6 py-3 text-left text-sm font-medium transition-colors ${
      activeView === viewId
        ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
    }`;

  return (
    <div className="bg-gray-50 w-64 min-h-screen border-r border-gray-200 flex flex-col">
      <nav className="mt-8 flex-1">
        {universalMenuItems.map(item => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={navButtonClass(item.id)}
          >
            <item.icon className="w-4 h-4 mr-3" />
            <span className="flex-1">{item.label}</span>
            {item.id === 'messages' && totalUnread > 0 && (
              <span className="min-w-[1.25rem] h-5 px-1.5 flex items-center justify-center rounded-full bg-amber-600 text-white text-xs font-medium">
                {totalUnread > 9 ? '9+' : totalUnread}
              </span>
            )}
          </button>
        ))}
        {visibleMenuItems.map(item => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={navButtonClass(item.id)}
          >
            <item.icon className="w-4 h-4 mr-3" />
            {item.label}
          </button>
        ))}
      </nav>
      <div className="border-t border-gray-200 mt-4">
        <button
          onClick={() => onNavigate('settings')}
          className={navButtonClass('settings')}
        >
          <Settings className="w-4 h-4 mr-3" />
          Settings
        </button>
      </div>
    </div>
  );
}
