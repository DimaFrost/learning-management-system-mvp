import { BookOpen, Users, UserCheck, TrendingUp, Calendar, GraduationCap } from 'lucide-react';

interface SidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
  hasRole: (role: string) => boolean;
}

export function Sidebar({ activeView, onNavigate, hasRole }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BookOpen, roles: ['administrator'] },
    { id: 'curriculum', label: 'Curriculum', icon: BookOpen, roles: ['administrator'] },
    { id: 'users', label: 'Users', icon: Users, roles: ['administrator'] },
    { id: 'mentorship', label: 'Mentorship', icon: UserCheck, roles: ['administrator'] },
    { id: 'mentorship-management', label: 'Mentorship Management', icon: TrendingUp, roles: ['administrator'] },
    { id: 'my-classes', label: 'My Classes', icon: Calendar, roles: ['teacher', 'translator'] },
    { id: 'mentor-dashboard', label: 'Mentor Dashboard', icon: UserCheck, roles: ['mentor'] },
    { id: 'my-course', label: 'My Course', icon: GraduationCap, roles: ['student'] }
  ];

  // Filter menu items based on user's roles
  const visibleMenuItems = menuItems.filter(item => 
    item.roles.some(role => hasRole(role))
  );

  return (
    <div className="bg-gray-50 w-64 min-h-screen border-r border-gray-200">
      <nav className="mt-8">
        {visibleMenuItems.map(item => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`w-full flex items-center px-6 py-3 text-left text-sm font-medium transition-colors ${
              activeView === item.id
                ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <item.icon className="w-4 h-4 mr-3" />
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
