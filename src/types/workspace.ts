export type WorkspaceId =
  | 'administrator'
  | 'mentor'
  | 'team_leader'
  | 'teacher'
  | 'translator'
  | 'student';

export const WORKSPACE_ORDER: WorkspaceId[] = [
  'administrator',
  'mentor',
  'team_leader',
  'teacher',
  'translator',
  'student',
];

export const WORKSPACE_LABELS: Record<WorkspaceId, string> = {
  administrator: 'Administrator',
  mentor: 'Mentor',
  team_leader: 'Team Leader',
  teacher: 'Teacher',
  translator: 'Translator',
  student: 'Student',
};

export const WORKSPACE_DEFAULT_VIEW: Record<WorkspaceId, string> = {
  administrator: 'dashboard',
  mentor: 'mentor-dashboard',
  team_leader: 'ministry-report',
  teacher: 'dashboard',
  translator: 'dashboard',
  student: 'dashboard',
};

export function isWorkspaceId(value: string | null): value is WorkspaceId {
  return !!value && WORKSPACE_ORDER.includes(value as WorkspaceId);
}

export function getAvailableWorkspaces(roles: readonly string[]): WorkspaceId[] {
  return WORKSPACE_ORDER.filter(workspace => roles.includes(workspace));
}
