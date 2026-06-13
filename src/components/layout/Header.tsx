import type { User } from '../../types/lms';
import { GraduationCap, LogOut } from 'lucide-react';

interface HeaderProps {
  currentUser: User;
  onOpenRoleSelector: () => void;
}

export function Header({ currentUser, onOpenRoleSelector }: HeaderProps) {
  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <GraduationCap className="w-8 h-8 text-blue-600" />
          <h1 className="text-xl font-semibold text-gray-900">The Burning Ones</h1>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-600">
            {currentUser.name} ({currentUser.roles.join(', ')})
          </span>
          <button 
            onClick={onOpenRoleSelector}
            className="p-2 text-gray-400 hover:text-gray-600"
            title="Switch User Role"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
