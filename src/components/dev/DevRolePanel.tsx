import { useState, useEffect } from 'react';
import type { UserRole } from '../../types/lms';

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
  realRoles: string[];
  onApply: (roles: string[] | null) => void;
  onClose: () => void;
}

export function DevRolePanel({
  isOpen,
  currentPreviewRoles,
  realRoles,
  onApply,
  onClose,
}: DevRolePanelProps) {
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>([]);

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

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden="true" />
      <div className="fixed top-16 right-6 z-50 w-72 bg-amber-50 border border-amber-200 rounded-lg shadow-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-sm font-semibold text-amber-900">Role Preview</h3>
          <span className="px-1.5 py-0.5 text-xs font-bold bg-amber-500 text-white rounded">DEV</span>
        </div>

        <div className="space-y-2 mb-4">
          {PREVIEWABLE_ROLES.map(role => (
            <label key={role} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedRoles.includes(role)}
                onChange={() => toggleRole(role)}
                className="rounded border-amber-300 text-amber-600 focus:ring-amber-500"
              />
              <span className="text-sm text-amber-900 capitalize">{role}</span>
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
