import type { User } from '../../types/lms';
import { GraduationCap, LogOut, Code2, Menu } from 'lucide-react';

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
  onOpenMobileMenu?: () => void;
}

export function Header({
  currentUser,
  onSignOut,
  isDev,
  previewRoles,
  onOpenDevPanel,
  onOpenMobileMenu,
}: HeaderProps) {
  const avatar = currentUser.avatarUrl ? (
    <img
      src={currentUser.avatarUrl}
      alt={currentUser.name}
      className="w-8 h-8 rounded-full object-cover"
    />
  ) : (
    <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-sm">
      {currentUser.name.charAt(0).toUpperCase()}
    </div>
  );

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-3 lg:px-6 lg:py-4 flex-shrink-0">
      {/* Mobile header */}
      <div className="flex lg:hidden items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="p-2.5 -ml-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <GraduationCap className="w-7 h-7 text-blue-600 flex-shrink-0" />
          <h1 className="text-base font-semibold text-gray-900 truncate">TBO</h1>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {isDev && (
            <button
              type="button"
              onClick={onOpenDevPanel}
              className="relative p-2.5 text-amber-600 hover:text-amber-800"
              title="Role Preview (Dev)"
            >
              <Code2 className="w-4 h-4" />
              {previewRoles !== null && (
                <span className="w-2 h-2 bg-amber-500 rounded-full absolute top-1.5 right-1.5" />
              )}
            </button>
          )}
          {avatar}
          <button
            onClick={onSignOut}
            className="p-2.5 text-gray-400 hover:text-gray-600"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Desktop header */}
      <div className="hidden lg:flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <GraduationCap className="w-8 h-8 text-blue-600" />
          <h1 className="text-xl font-semibold text-gray-900">The Burning Ones</h1>
        </div>
        <div className="flex items-center space-x-4 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            {avatar}
            <span className="text-sm text-gray-600 truncate max-w-[280px] xl:max-w-md">
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
