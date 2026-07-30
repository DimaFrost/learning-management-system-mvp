import type { MinistryTeam, User } from '../types/lms';

function isTranslationMinistryTeam(team: MinistryTeam): boolean {
  const name = team.name.trim().toLowerCase();
  const nameBg = team.nameBg?.trim().toLowerCase() ?? '';
  return name === 'translation' || nameBg === 'превод';
}

/** True if the user actively leads/reports for the Translation (Превод) ministry team. */
export function isTranslationMinistryTeamLeader(
  user: Pick<User, 'id' | 'roles'>,
  ministryTeams: MinistryTeam[]
): boolean {
  if (!user.roles.includes('team_leader')) return false;

  return ministryTeams.some(team =>
    team.active &&
    isTranslationMinistryTeam(team) &&
    (
      team.members.some(member =>
        member.userId === user.id &&
        member.active &&
        member.canSubmitReports
      ) ||
      team.leaderId === user.id
    )
  );
}
