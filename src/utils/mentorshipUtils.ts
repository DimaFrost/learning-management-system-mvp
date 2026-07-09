import type { MentorshipLog } from '../types/lms';

type CadenceSettings = {
  digital: { expectedDays: number; warningDays: number; criticalDays: number };
  inPerson: { expectedDays: number; warningDays: number; criticalDays: number };
};

function daysSince(dateStr: string): number {
  const today = new Date();
  return Math.floor((today.getTime() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function getInPersonStatusScore(
  lastInPerson: MentorshipLog | undefined,
  cadenceSettings: CadenceSettings
): number {
  if (!lastInPerson) return 0;

  const days = daysSince(lastInPerson.date);
  const settings = cadenceSettings.inPerson;

  if (days >= settings.criticalDays) return 0;
  if (days >= settings.warningDays) return 1;
  return 2;
}

export const calculateOverallStatus = (
  studentId: string,
  mentorshipLogs: MentorshipLog[],
  cadenceSettings: CadenceSettings
): 'at_risk' | 'lagging' | 'on_track' => {
  const studentLogs = mentorshipLogs.filter(log => log.studentId === studentId);
  const inPersonCheckIns = studentLogs
    .filter(log => log.type === 'in_person')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const lastInPerson = inPersonCheckIns[0];
  const score = getInPersonStatusScore(lastInPerson, cadenceSettings);

  if (score === 0) return 'at_risk';
  if (score === 1) return 'lagging';
  return 'on_track';
};

export const getCheckInStatus = (
  studentId: string,
  type: 'digital' | 'in_person',
  mentorshipLogs: MentorshipLog[],
  cadenceSettings: CadenceSettings
): { status: string; daysSince: number | null; message: string } => {
  if (type === 'digital') {
    const checkIns = mentorshipLogs
      .filter(log => log.studentId === studentId && log.type === 'digital')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const lastCheckIn = checkIns[0];
    if (!lastCheckIn) {
      return { status: 'on_track', daysSince: null, message: 'Optional' };
    }
    const days = daysSince(lastCheckIn.date);
    return { status: 'on_track', daysSince: days, message: `${days}d ago (optional)` };
  }

  const checkIns = mentorshipLogs
    .filter(log => log.studentId === studentId && log.type === type)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const lastCheckIn = checkIns[0];

  if (!lastCheckIn) return { status: 'at_risk', daysSince: null, message: 'No meetings yet' };

  const days = daysSince(lastCheckIn.date);
  const settings = cadenceSettings.inPerson;

  if (days >= settings.criticalDays) return { status: 'at_risk', daysSince: days, message: `${days}d overdue` };
  if (days >= settings.warningDays) return { status: 'lagging', daysSince: days, message: `${days}d ago` };
  return { status: 'on_track', daysSince: days, message: `${days}d ago` };
};
