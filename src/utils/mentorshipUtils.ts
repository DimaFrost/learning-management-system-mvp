import type { MentorshipLog } from '../types/lms';

type CadenceSettings = {
  digital: { expectedDays: number; warningDays: number; criticalDays: number };
  inPerson: { expectedDays: number; warningDays: number; criticalDays: number };
};

function daysSince(dateStr: string): number {
  const today = new Date();
  return Math.floor((today.getTime() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

export const calculateOverallStatus = (studentId: string, mentorshipLogs: MentorshipLog[], cadenceSettings: CadenceSettings): 'at_risk' | 'lagging' | 'on_track' => {
  // Get mentorship logs for this student
  const studentLogs = mentorshipLogs.filter(log => log.studentId === studentId);
  
  // Get last check-ins by type
  const digitalCheckIns = studentLogs.filter(c => c.type === 'digital').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const inPersonCheckIns = studentLogs.filter(c => c.type === 'in_person').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  const lastDigital = digitalCheckIns[0];
  const lastInPerson = inPersonCheckIns[0];
  
  // Calculate individual status scores (0 = At Risk, 1 = Lagging, 2 = On Track)
  const getStatusScore = (checkIn: any, type: 'digital' | 'in_person') => {
    if (!checkIn) return 0; // No check-ins = At Risk
    
    const days = daysSince(checkIn.date);
    const settings = type === 'digital' ? cadenceSettings.digital : cadenceSettings.inPerson;
    
    if (days >= settings.criticalDays) return 0; // At Risk
    if (days >= settings.warningDays) return 1; // Lagging
    return 2; // On Track
  };
  
  const digitalScore = getStatusScore(lastDigital, 'digital');
  const inPersonScore = getStatusScore(lastInPerson, 'in_person');
  
  // Calculate weighted average (50/50 split)
  const overallScore = (digitalScore * 0.5) + (inPersonScore * 0.5);
  
  // Convert back to status
  if (overallScore <= 0.5) return 'at_risk';
  if (overallScore <= 1.5) return 'lagging';
  return 'on_track';
};

export const getCheckInStatus = (studentId: string, type: 'digital' | 'in_person', mentorshipLogs: MentorshipLog[], cadenceSettings: CadenceSettings): { status: string; daysSince: number | null; message: string } => {
  const checkIns = mentorshipLogs.filter(log => log.studentId === studentId && log.type === type).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const lastCheckIn = checkIns[0];
  
  if (!lastCheckIn) return { status: 'at_risk', daysSince: 999, message: 'No check-ins' };
  
  const days = daysSince(lastCheckIn.date);
  const settings = type === 'digital' ? cadenceSettings.digital : cadenceSettings.inPerson;
  
  if (days >= settings.criticalDays) return { status: 'at_risk', daysSince: days, message: `${days}d overdue` };
  if (days >= settings.warningDays) return { status: 'lagging', daysSince: days, message: `${days}d ago` };
  return { status: 'on_track', daysSince: days, message: `${days}d ago` };
};
