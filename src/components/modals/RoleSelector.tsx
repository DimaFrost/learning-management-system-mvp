import type { User } from '../../types/lms';
import { X } from 'lucide-react';

interface RoleSelectorProps {
  isOpen: boolean;
  currentUser: User;
  onSelectUser: (user: User) => void;
  onClose: () => void;
}

export function RoleSelector({ isOpen, currentUser, onSelectUser, onClose }: RoleSelectorProps) {
  if (!isOpen) return null;

  const availableRoles = [
    { id: 1, name: 'Admin User', email: 'admin@example.com', roles: ['administrator'] },
    { id: 2, name: 'John Teacher', email: 'john@example.com', roles: ['teacher'] },
    { id: 3, name: 'Maria Translator', email: 'maria@example.com', roles: ['translator'] },
    { id: 4, name: 'Bob Mentor', email: 'bob@example.com', roles: ['mentor'] },
    { id: 5, name: 'Alice Student', email: 'alice@example.com', roles: ['student'] },
    { id: 6, name: 'David Student', email: 'david@example.com', roles: ['student'] },
    { id: 7, name: 'Sarah Multi-Role', email: 'sarah@example.com', roles: ['teacher', 'translator', 'mentor'] },
    { id: 8, name: 'Mike Teacher-Mentor', email: 'mike@example.com', roles: ['teacher', 'mentor'] }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Switch User Role</h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="space-y-2">
          {availableRoles.map(user => (
            <button
              key={user.id}
              onClick={() => {
                onSelectUser(user);
                onClose();
              }}
              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                currentUser.id === user.id 
                  ? 'bg-blue-50 border-blue-200 text-blue-900' 
                  : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
              }`}
            >
              <div className="font-medium">{user.name}</div>
              <div className="text-sm text-gray-600">{user.email}</div>
              <div className="text-xs text-gray-500 mt-1">
                Role: {user.roles.join(', ')}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
