import { useEffect, useRef, useState } from 'react';
import type { User } from '../../types/lms';
import type { WorkspaceId } from '../../types/workspace';
import { WORKSPACE_LABELS } from '../../types/workspace';
import { LogOut, Code2, Menu, Briefcase, Check, ChevronsUpDown } from 'lucide-react';
import tboLogo from '../../assets/tbo-logo.svg';

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
  activeWorkspace: WorkspaceId | null;
  availableWorkspaces: WorkspaceId[];
  onWorkspaceChange: (workspace: WorkspaceId) => void;
  onOpenDevPanel: () => void;
  onOpenMobileMenu?: () => void;
}

export function Header({
  currentUser,
  onSignOut,
  isDev,
  previewRoles,
  activeWorkspace,
  availableWorkspaces,
  onWorkspaceChange,
  onOpenDevPanel,
  onOpenMobileMenu,
}: HeaderProps) {
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const workspaceMenuRef = useRef<HTMLDivElement | null>(null);
  const workspaceLabel = activeWorkspace ? WORKSPACE_LABELS[activeWorkspace] : 'Workspace';
  const canSwitchWorkspace = !!activeWorkspace && availableWorkspaces.length > 1;
  const roleButtonLabel = activeWorkspace ? workspaceLabel : 'No role';

  useEffect(() => {
    if (!workspaceMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!workspaceMenuRef.current?.contains(event.target as Node)) {
        setWorkspaceMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [workspaceMenuOpen]);

  const avatar = currentUser.avatarUrl ? (
    <img
      src={currentUser.avatarUrl}
      alt={currentUser.name}
      className="h-8 w-8 rounded-full border border-[#e5e5e5] object-cover"
    />
  ) : (
    <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#e5e5e5] bg-[#f5f5f5] text-sm font-semibold text-[#171717]">
      {currentUser.name.charAt(0).toUpperCase()}
    </div>
  );

  return (
    <div className="flex-shrink-0 border-b border-[#e5e5e5] bg-white/95 px-4 py-3 lg:px-6">
      {/* Mobile header */}
      <div className="flex lg:hidden items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="tbo-focus -ml-2 rounded-lg p-2.5 text-[#525252] hover:bg-[#f5f5f5] hover:text-[#171717]"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <img src={tboLogo} alt="" className="h-7 w-7 flex-shrink-0 rounded-full" />
          <h1 className="truncate text-sm font-semibold text-[#171717]">TBO</h1>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {isDev && (
            <button
              type="button"
              onClick={onOpenDevPanel}
              className="tbo-focus relative rounded-lg p-2.5 text-[#ea580c] hover:bg-[#fff7ed]"
              title="Role Preview (Dev)"
            >
              <Code2 className="w-4 h-4" />
              {previewRoles !== null && (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#ea580c]" />
              )}
            </button>
          )}
          {avatar}
          <button
            onClick={onSignOut}
            className="tbo-focus rounded-lg p-2.5 text-[#737373] hover:bg-[#f5f5f5] hover:text-[#171717]"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Desktop header */}
      <div className="hidden lg:flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-[#e5e5e5] bg-white">
            <img src={tboLogo} alt="" className="h-8 w-8" />
          </span>
          <div>
            <h1 className="text-sm font-semibold text-[#171717]">The Burning Ones</h1>
            <p className="text-xs text-[#737373]">Learning management system</p>
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {avatar}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[#171717] max-w-[280px] xl:max-w-md">
                {currentUser.name}
              </p>
            </div>
          </div>
          <div ref={workspaceMenuRef} className="relative">
            <button
              type="button"
              onClick={() => {
                if (canSwitchWorkspace) {
                  setWorkspaceMenuOpen(open => !open);
                }
              }}
              disabled={!canSwitchWorkspace}
              className={`tbo-focus relative flex items-center gap-2 rounded-lg border px-2.5 py-2 text-sm font-medium ${
                activeWorkspace
                  ? canSwitchWorkspace
                    ? 'border-[#e5e5e5] bg-white text-[#171717] hover:bg-[#f5f5f5]'
                    : 'cursor-default border-[#e5e5e5] bg-white text-[#171717]'
                  : 'cursor-default border-[#e5e5e5] bg-[#fafafa] text-[#a3a3a3]'
              }`}
              title={canSwitchWorkspace ? 'Switch role' : roleButtonLabel}
              aria-label={canSwitchWorkspace ? 'Switch role' : roleButtonLabel}
              aria-expanded={canSwitchWorkspace ? workspaceMenuOpen : undefined}
            >
              <Briefcase className={`h-4 w-4 ${activeWorkspace ? 'text-[#2563eb]' : 'text-[#a3a3a3]'}`} />
              <span className="max-w-[120px] truncate">{roleButtonLabel}</span>
              {canSwitchWorkspace && <ChevronsUpDown className="h-3.5 w-3.5 text-[#737373]" />}
            </button>
            {canSwitchWorkspace && workspaceMenuOpen && (
              <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-48 rounded-xl border border-[#e5e5e5] bg-white p-1.5 shadow-[0_16px_40px_rgba(15,23,42,0.14)]">
                {availableWorkspaces.map(workspace => {
                  const selected = workspace === activeWorkspace;

                  return (
                    <button
                      key={workspace}
                      type="button"
                      onClick={() => {
                        onWorkspaceChange(workspace);
                        setWorkspaceMenuOpen(false);
                      }}
                      className={`tbo-focus flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                        selected
                          ? 'bg-[#eff6ff] text-[#1d4ed8]'
                          : 'text-[#525252] hover:bg-[#f5f5f5] hover:text-[#171717]'
                      }`}
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white text-[#2563eb] shadow-[inset_0_0_0_1px_rgba(229,229,229,0.9)]">
                        {selected ? <Check className="h-3.5 w-3.5" /> : <Briefcase className="h-3.5 w-3.5" />}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {WORKSPACE_LABELS[workspace]}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {isDev && (
            <button
              type="button"
              onClick={onOpenDevPanel}
              className="tbo-focus relative flex items-center gap-1.5 rounded-lg border border-[#e5e5e5] bg-white px-2.5 py-2 text-[#ea580c] hover:bg-[#fff7ed]"
              title="Role Preview (Dev)"
            >
              <Code2 className="w-4 h-4" />
              {previewRoles !== null && (
                <>
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#ea580c]" />
                  <span className="text-xs font-medium text-[#c2410c]">
                    {formatPreviewAbbrev(previewRoles)}
                  </span>
                </>
              )}
            </button>
          )}
          <button
            onClick={onSignOut}
            className="tbo-focus rounded-lg border border-[#e5e5e5] bg-white p-2 text-[#737373] hover:bg-[#f5f5f5] hover:text-[#171717]"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
