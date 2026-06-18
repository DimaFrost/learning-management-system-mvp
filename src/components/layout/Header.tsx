import type { User } from '../../types/lms';
import { GraduationCap, LogOut, Code2 } from 'lucide-react';

const ROLE_ABBREVS: Record<string, string> = {
  administrator: 'A',
  teacher: 'T',
  translator: 'Tr',
  mentor: 'M',
  student: 'S',
};

function formatPreviewAbbrev(roles: string[]): string {
  return roles
    .map(role => ROLE_ABBREVS[role] ?? role.charAt(0).toUpperCase())
    .join('+');
}

interface HeaderProps {
  currentUser: User;
  onSignOut: () => void;
  isDev: boolean;
  previewRoles: string[] | null;
  onOpenDevPanel: () => void;
}

export function Header({ currentUser, onSignOut, isDev, previewRoles, onOpenDevPanel }: HeaderProps) {
  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <GraduationCap className="w-8 h-8 text-blue-600" />
          <h1 className="text-xl font-semibold text-gray-900">The Burning Ones</h1>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center gap-2">
            {currentUser.avatarUrl ? (
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.name}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-sm">
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="text-sm text-gray-600">
              {currentUser.name} ({currentUser.roles.join(', ')})
            </span>
          </div>
          {isDev && (
            <button
              type="button"
              onClick={onOpenDevPanel}
              className="relative flex items-center gap-1.5 p-2 text-amber-600 hover:text-amber-800"
              title="Role Preview (Dev)"
            >
              <Code2 className="w-4 h-4" />
              {previewRoles !== null && (
                <>
                  <span className="w-2 h-2 bg-amber-500 rounded-full absolute top-1 right-1" />
                  <span className="text-xs font-medium text-amber-700">
                    {formatPreviewAbbrev(previewRoles)}
                  </span>
                </>
              )}
            </button>
          )}
          <button
            onClick={onSignOut}
            className="p-2 text-gray-400 hover:text-gray-600"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
