import { useState, useEffect } from 'react';
import type { User, UserRole } from '../../types/lms';
import { formatRoleLabel } from '../../utils/userManagementUtils';

const PREVIEWABLE_ROLES: UserRole[] = [
  'administrator',
  'teacher',
  'translator',
  'mentor',
  'team_leader',
  'student',
];

interface DevRolePanelProps {
  isOpen: boolean;
  currentPreviewRoles: string[] | null;
  currentPreviewUserId: string | null;
  realRoles: string[];
  users: User[];
  onApply: (roles: string[] | null) => void;
  onViewAsUser: (userId: string | null) => void;
  onClose: () => void;
}

export function DevRolePanel({
  isOpen,
  currentPreviewRoles,
  currentPreviewUserId,
  realRoles,
  users,
  onApply,
  onViewAsUser,
  onClose,
}: DevRolePanelProps) {
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>([]);
  const [userSearch, setUserSearch] = useState('');

  useEffect(() => {
    if (isOpen) {
      const initial =
        currentPreviewRoles ??
        realRoles.filter((r): r is UserRole => r !== 'dev' && PREVIEWABLE_ROLES.includes(r as UserRole));
      setSelectedRoles(initial as UserRole[]);
    }
  }, [isOpen, currentPreviewRoles, realRoles]);

  if (!isOpen) return null;

  const toggleRole = (role: UserRole) => {
    setSelectedRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  const handleApply = () => {
    if (selectedRoles.length === 0) return;
    onApply(selectedRoles);
  };

  const handleReset = () => {
    onApply(null);
  };

  const previewUser = currentPreviewUserId
    ? users.find(user => user.id === currentPreviewUserId)
    : null;
  const filteredUsers = users
    .filter(user => `${user.name} ${user.email}`.toLowerCase().includes(userSearch.trim().toLowerCase()))
    .slice(0, 8);

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden="true" />
      <div className="fixed top-16 right-6 z-50 w-80 bg-amber-50 border border-amber-200 rounded-lg shadow-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-sm font-semibold text-amber-900">Dev Preview</h3>
          <span className="px-1.5 py-0.5 text-xs font-bold bg-amber-500 text-white rounded">DEV</span>
        </div>

        <div className="mb-5 rounded-lg border border-amber-200 bg-white/70 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-900">View as user</p>
            {previewUser && (
              <button
                type="button"
                onClick={() => onViewAsUser(null)}
                className="text-xs font-semibold text-amber-700 hover:text-amber-900"
              >
                Reset
              </button>
            )}
          </div>
          <input
            value={userSearch}
            onChange={event => setUserSearch(event.target.value)}
            className="mb-2 h-9 w-full rounded-lg border border-amber-200 bg-white px-3 text-sm text-amber-950 outline-none focus:ring-2 focus:ring-amber-400"
            placeholder="Search name or email"
          />
          {previewUser && (
            <p className="mb-2 rounded-md bg-amber-100 px-2 py-1.5 text-xs font-semibold text-amber-900">
              Viewing as {previewUser.name}
            </p>
          )}
          <div className="max-h-44 overflow-y-auto space-y-1">
            {filteredUsers.map(user => {
              const selected = currentPreviewUserId === user.id;
              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => onViewAsUser(user.id)}
                  className={`w-full rounded-lg px-2 py-2 text-left text-sm transition ${
                    selected ? 'bg-amber-600 text-white' : 'bg-white text-amber-950 hover:bg-amber-100'
                  }`}
                >
                  <span className="block truncate font-semibold">{user.name}</span>
                  <span className={`block truncate text-xs ${selected ? 'text-white/75' : 'text-amber-700'}`}>
                    {user.email}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-amber-900">Role preview</p>
        <div className="space-y-2 mb-4">
          {PREVIEWABLE_ROLES.map(role => (
            <label key={role} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedRoles.includes(role)}
                onChange={() => toggleRole(role)}
                className="rounded border-amber-300 text-amber-600 focus:ring-amber-500"
              />
              <span className="text-sm text-amber-900">{formatRoleLabel(role)}</span>
            </label>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleApply}
            disabled={selectedRoles.length === 0}
            className="w-full px-3 py-2 text-sm font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="w-full px-3 py-2 text-sm font-medium bg-white text-amber-800 border border-amber-300 rounded-lg hover:bg-amber-100"
          >
            Reset to real roles
          </button>
        </div>
      </div>
    </>
  );
}
