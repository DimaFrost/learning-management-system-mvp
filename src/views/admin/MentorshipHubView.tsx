import { useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Settings,
  UserCheck,
  Users,
} from 'lucide-react';
import type { Course, CourseStudent, MentorshipLog, User } from '../../types/lms';
import type { CadenceSettings } from '../../hooks/useCadenceSettings';
import { calculateOverallStatus } from '../../utils/mentorshipUtils';
import { formatPlatformDate } from '../../utils/dateUtils';
import { MentorshipAssignmentsPanel } from './MentorshipAssignmentsPanel';
import { MentorshipFollowUpPanel } from './MentorshipFollowUpPanel';
import { MentorshipCadencePanel } from './MentorshipCadencePanel';
import {
  EmptyState,
  OverallStatusBadge,
  PageStatGrid,
  PersonAvatar,
  ProgressBar,
  SectionCard,
} from './mentorshipShared';

export type MentorshipSection = 'overview' | 'assignments' | 'follow-up' | 'check-in-rules';

export interface MentorshipHubViewProps {
  activeSection?: MentorshipSection;
  onNavigate?: (view: string) => void;
  users: User[];
  courseStudents: CourseStudent[];
  courses: Course[];
  mentorshipLogs: MentorshipLog[];
  cadenceSettings: CadenceSettings;
  setCadenceSettings: (settings: CadenceSettings) => void;
  getUserById: (id: string | null) => User | undefined;
  getCourseDisplayName: (course: Course) => string;
  onAssignMentor: (studentId: string, courseId: number, mentorId: string) => Promise<void>;
  onOpenCheckin: (studentId: string, existingLog?: MentorshipLog) => void;
}

const sectionMeta: Record<MentorshipSection, { title: string; eyebrow: string; description: string }> = {
  overview: {
    title: 'Overview',
    eyebrow: 'Mentorship health',
    description: 'A quick read on coverage, check-in rhythm, and who needs attention right now.',
  },
  assignments: {
    title: 'Assignments',
    eyebrow: 'Student-mentor pairs',
    description: 'Match students with mentors, review history, and log check-ins in one place.',
  },
  'follow-up': {
    title: 'Follow-up',
    eyebrow: 'Risk monitoring',
    description: 'Filter by status, spot overdue contact, and act on pairs that need support.',
  },
  'check-in-rules': {
    title: 'Check-in rules',
    eyebrow: 'In-person meetings',
    description: 'Set how often mentors should meet students face-to-face, and when follow-up flags at-risk.',
  },
};

const sectionNav: Array<{
  section: MentorshipSection;
  view: string;
  label: string;
  icon: typeof Activity;
}> = [
  { section: 'overview', view: 'mentorship-overview', label: 'Overview', icon: Activity },
  { section: 'assignments', view: 'mentorship-assignments', label: 'Assignments', icon: UserCheck },
  { section: 'follow-up', view: 'mentorship-follow-up', label: 'Follow-up', icon: AlertTriangle },
  { section: 'check-in-rules', view: 'mentorship-check-in-rules', label: 'Check-in rules', icon: Settings },
];

const quickLinks: Array<{
  section: MentorshipSection;
  view: string;
  title: string;
  description: string;
  icon: typeof Activity;
}> = [
  { section: 'assignments', view: 'mentorship-assignments', title: 'Assignments', description: 'Manage pairs & log check-ins', icon: UserCheck },
  { section: 'follow-up', view: 'mentorship-follow-up', title: 'Follow-up', description: 'Monitor at-risk students', icon: AlertTriangle },
  { section: 'check-in-rules', view: 'mentorship-check-in-rules', title: 'Check-in rules', description: 'Edit meeting expectations', icon: Settings },
];

export function MentorshipHubView({
  activeSection = 'overview',
  onNavigate,
  users,
  courseStudents,
  courses,
  mentorshipLogs,
  cadenceSettings,
  setCadenceSettings,
  getUserById,
  getCourseDisplayName,
  onAssignMentor,
  onOpenCheckin,
}: MentorshipHubViewProps) {
  const activeStudents = users.filter(user => user.roles.includes('student'));
  const activeMentors = users.filter(user => user.roles.includes('mentor'));
  const assignedPairs = courseStudents.filter(enrollment => enrollment.mentorId && enrollment.status === 'active');

  const studentsWithoutMentor = useMemo(() => {
    const studentIds = new Set(activeStudents.map(student => student.id));
    return Array.from(studentIds).filter(studentId => {
      const enrollments = courseStudents.filter(
        enrollment => enrollment.studentId === studentId && enrollment.status === 'active'
      );
      if (enrollments.length === 0) return false;
      return !enrollments.some(enrollment => enrollment.mentorId);
    });
  }, [activeStudents, courseStudents]);

  const statusCounts = useMemo(() => {
    const studentIds = new Set(assignedPairs.map(pair => pair.studentId));
    let atRisk = 0;
    let lagging = 0;
    let onTrack = 0;

    studentIds.forEach(studentId => {
      const status = calculateOverallStatus(studentId, mentorshipLogs, cadenceSettings);
      if (status === 'at_risk') atRisk += 1;
      else if (status === 'lagging') lagging += 1;
      else onTrack += 1;
    });

    return { atRisk, lagging, onTrack, tracked: studentIds.size };
  }, [assignedPairs, cadenceSettings, mentorshipLogs]);

  const recentCheckIns = mentorshipLogs.filter(log => {
    const days = Math.floor((Date.now() - new Date(log.date).getTime()) / (1000 * 60 * 60 * 24));
    return days <= 7;
  }).length;

  const coveragePercent = activeStudents.length === 0
    ? 100
    : Math.round(((activeStudents.length - studentsWithoutMentor.length) / activeStudents.length) * 100);

  const avgCheckIns = assignedPairs.length === 0
    ? 0
    : Math.round(
        assignedPairs.reduce((sum, pair) => {
          return sum + mentorshipLogs.filter(log => log.studentId === pair.studentId).length;
        }, 0) / assignedPairs.length
      );

  const recentActivity = useMemo(() => {
    return [...mentorshipLogs]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6)
      .map(log => ({
        ...log,
        studentName: getUserById(log.studentId)?.name ?? 'Unknown student',
        mentorName: getUserById(log.mentorId)?.name ?? 'Unknown mentor',
      }));
  }, [getUserById, mentorshipLogs]);

  const attentionList = useMemo(() => {
    const atRisk = Array.from(new Set(assignedPairs.map(pair => pair.studentId)))
      .filter(studentId => calculateOverallStatus(studentId, mentorshipLogs, cadenceSettings) === 'at_risk')
      .map(studentId => ({
        id: studentId,
        name: getUserById(studentId)?.name ?? 'Unknown',
        kind: 'at_risk' as const,
      }));

    const unassigned = studentsWithoutMentor.map(studentId => ({
      id: studentId,
      name: getUserById(studentId)?.name ?? 'Unknown',
      kind: 'unassigned' as const,
    }));

    return [...atRisk, ...unassigned].slice(0, 8);
  }, [assignedPairs, cadenceSettings, getUserById, mentorshipLogs, studentsWithoutMentor]);

  const pageStatsBySection = useMemo(() => ({
    overview: [
      { label: 'Active pairs', value: assignedPairs.length, detail: `${activeMentors.length} mentors available`, icon: Users, accent: 'bg-[#dbeaff] text-[#2563eb]' },
      { label: 'Coverage', value: `${coveragePercent}%`, detail: `${studentsWithoutMentor.length} still unassigned`, icon: UserCheck, accent: coveragePercent >= 90 ? 'bg-[#dcfce7] text-[#16a34a]' : 'bg-[#fff7ed] text-[#ea580c]' },
      { label: 'At risk', value: statusCounts.atRisk, detail: `${statusCounts.lagging} lagging`, icon: AlertTriangle, accent: 'bg-[#fee2e2] text-[#dc2626]' },
      { label: 'This week', value: recentCheckIns, detail: 'check-ins logged', icon: Activity, accent: 'bg-[#f3e8ff] text-[#7c3aed]' },
    ],
    assignments: [
      { label: 'Active pairs', value: assignedPairs.length, detail: 'students with mentors', icon: UserCheck, accent: 'bg-[#dbeaff] text-[#2563eb]' },
      { label: 'Needs mentor', value: studentsWithoutMentor.length, detail: 'awaiting assignment', icon: AlertTriangle, accent: 'bg-[#fff7ed] text-[#ea580c]' },
      { label: 'Avg check-ins', value: avgCheckIns, detail: 'per assigned pair', icon: ClipboardList, accent: 'bg-[#f3e8ff] text-[#7c3aed]' },
      { label: 'This week', value: recentCheckIns, detail: 'new logs', icon: Calendar, accent: 'bg-[#dcfce7] text-[#16a34a]' },
    ],
    'follow-up': [
      { label: 'At risk', value: statusCounts.atRisk, detail: 'need immediate follow-up', icon: AlertTriangle, accent: 'bg-[#fee2e2] text-[#dc2626]' },
      { label: 'Lagging', value: statusCounts.lagging, detail: 'approaching thresholds', icon: Activity, accent: 'bg-[#fff7ed] text-[#ea580c]' },
      { label: 'On track', value: statusCounts.onTrack, detail: 'meeting expectations', icon: CheckCircle2, accent: 'bg-[#dcfce7] text-[#16a34a]' },
      { label: 'Tracked', value: statusCounts.tracked, detail: 'students with mentors', icon: Users, accent: 'bg-[#dbeaff] text-[#2563eb]' },
    ],
    'check-in-rules': [
      { label: 'Expected gap', value: `${cadenceSettings.inPerson.expectedDays}d`, detail: 'between in-person meetings', icon: Users, accent: 'bg-[#dcfce7] text-[#16a34a]' },
      { label: 'Warning', value: `${cadenceSettings.inPerson.warningDays}d`, detail: 'shows as lagging', icon: Activity, accent: 'bg-[#fff7ed] text-[#ea580c]' },
      { label: 'Critical', value: `${cadenceSettings.inPerson.criticalDays}d`, detail: 'shows as at risk', icon: AlertTriangle, accent: 'bg-[#fee2e2] text-[#dc2626]' },
      { label: 'Tracked pairs', value: statusCounts.tracked, detail: 'in-person rules only', icon: UserCheck, accent: 'bg-[#dbeaff] text-[#2563eb]' },
    ],
  }), [
    activeMentors.length,
    assignedPairs.length,
    avgCheckIns,
    cadenceSettings,
    coveragePercent,
    recentCheckIns,
    statusCounts,
    studentsWithoutMentor.length,
  ]);

  const statusTotal = Math.max(statusCounts.tracked, 1);

  const renderOverview = () => (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard className="p-4 lg:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-[#171717]">Mentor coverage</h3>
              <p className="mt-1 text-sm text-[#737373]">
                {activeStudents.length - studentsWithoutMentor.length} of {activeStudents.length} students have a mentor.
              </p>
            </div>
            <span className="text-2xl font-semibold text-[#171717]">{coveragePercent}%</span>
          </div>
          <div className="mt-4">
            <ProgressBar
              value={coveragePercent}
              tone={coveragePercent >= 90 ? 'green' : coveragePercent >= 70 ? 'amber' : 'red'}
            />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-[#fef2f2] p-3 text-center ring-1 ring-[#fecaca]">
              <p className="text-xl font-semibold text-[#b91c1c]">{statusCounts.atRisk}</p>
              <p className="mt-1 text-xs font-medium text-[#991b1b]">At risk</p>
            </div>
            <div className="rounded-xl bg-[#fffbeb] p-3 text-center ring-1 ring-[#fde68a]">
              <p className="text-xl font-semibold text-[#b45309]">{statusCounts.lagging}</p>
              <p className="mt-1 text-xs font-medium text-[#92400e]">Lagging</p>
            </div>
            <div className="rounded-xl bg-[#f0fdf4] p-3 text-center ring-1 ring-[#bbf7d0]">
              <p className="text-xl font-semibold text-[#15803d]">{statusCounts.onTrack}</p>
              <p className="mt-1 text-xs font-medium text-[#166534]">On track</p>
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between text-xs text-[#737373]">
              <span>Follow-up health</span>
              <span>{statusCounts.tracked} students</span>
            </div>
            <div className="flex h-3 overflow-hidden rounded-full bg-[#f0f0f0]">
              <div className="bg-[#dc2626]" style={{ width: `${(statusCounts.atRisk / statusTotal) * 100}%` }} />
              <div className="bg-[#f59e0b]" style={{ width: `${(statusCounts.lagging / statusTotal) * 100}%` }} />
              <div className="bg-[#16a34a]" style={{ width: `${(statusCounts.onTrack / statusTotal) * 100}%` }} />
            </div>
          </div>
        </SectionCard>

        <SectionCard className="p-4 lg:p-5">
          <h3 className="font-semibold text-[#171717]">In-person meeting rules</h3>
          <p className="mt-1 text-sm text-[#737373]">
            Follow-up status is based on face-to-face meetings. Digital check-ins are optional and not tracked here.
          </p>
          <div className="mt-4 rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] p-4">
            <div className="flex items-center gap-2 text-[#15803d]">
              <Users className="h-4 w-4" />
              <span className="text-sm font-semibold">In-person meetings</span>
            </div>
            <p className="mt-2 text-sm leading-6 text-[#525252]">
              Expected every <strong>{cadenceSettings.inPerson.expectedDays}</strong> days
              <br />
              Lagging after {cadenceSettings.inPerson.warningDays} days · At risk after {cadenceSettings.inPerson.criticalDays} days
            </p>
          </div>
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('mentorship-check-in-rules')}
              className="tbo-focus mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#2563eb] hover:text-[#1d4ed8]"
            >
              Edit check-in rules
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </SectionCard>
      </div>

      {onNavigate && (
        <div className="grid gap-3 sm:grid-cols-3">
          {quickLinks.map(link => {
            const Icon = link.icon;
            return (
              <button
                key={link.view}
                type="button"
                onClick={() => onNavigate(link.view)}
                className="tbo-focus group rounded-xl border border-[#e5e5e5] bg-white p-4 text-left transition hover:border-[#d4d4d4] hover:shadow-sm"
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#f5f5f5] text-[#525252] group-hover:bg-[#171717] group-hover:text-white">
                  <Icon className="h-4 w-4" />
                </span>
                <p className="mt-3 font-semibold text-[#171717]">{link.title}</p>
                <p className="mt-1 text-sm text-[#737373]">{link.description}</p>
              </button>
            );
          })}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard className="overflow-hidden">
          <div className="border-b border-[#e5e5e5] px-4 py-3">
            <h3 className="font-semibold text-[#171717]">Needs attention</h3>
            <p className="text-sm text-[#737373]">At-risk pairs and students without mentors.</p>
          </div>
          <div className="divide-y divide-[#f0f0f0]">
            {attentionList.length > 0 ? attentionList.map(item => (
              <div key={`${item.kind}-${item.id}`} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <PersonAvatar name={item.name} tone={item.kind === 'unassigned' ? 'alert' : 'student'} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[#171717]">{item.name}</p>
                    <p className="text-xs text-[#737373]">
                      {item.kind === 'unassigned' ? 'No mentor assigned' : 'Check-in overdue'}
                    </p>
                  </div>
                </div>
                {item.kind === 'unassigned' ? (
                  onNavigate && (
                    <button
                      type="button"
                      onClick={() => onNavigate('mentorship-assignments')}
                      className="shrink-0 rounded-lg border border-[#d4d4d4] px-2.5 py-1.5 text-xs font-semibold text-[#525252] hover:bg-[#f5f5f5]"
                    >
                      Assign
                    </button>
                  )
                ) : (
                  <OverallStatusBadge status="at_risk" />
                )}
              </div>
            )) : (
              <div className="px-4 py-8 text-center text-sm text-[#737373]">
                <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-[#16a34a]" />
                Everyone is assigned and no pairs are at risk.
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard className="overflow-hidden">
          <div className="border-b border-[#e5e5e5] px-4 py-3">
            <h3 className="font-semibold text-[#171717]">Recent check-ins</h3>
            <p className="text-sm text-[#737373]">Latest mentor activity across all pairs.</p>
          </div>
          <div className="divide-y divide-[#f0f0f0]">
            {recentActivity.length > 0 ? recentActivity.map(log => (
              <div key={log.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-[#171717]">{log.studentName}</p>
                  <p className="mt-0.5 text-xs text-[#737373]">
                    {log.type === 'digital' ? 'Digital' : 'In-person'} · {log.mentorName}
                  </p>
                  {log.notes && <p className="mt-1 line-clamp-2 text-xs text-[#525252]">{log.notes}</p>}
                </div>
                <span className="shrink-0 text-xs text-[#737373]">{formatPlatformDate(log.date)}</span>
              </div>
            )) : (
              <EmptyState icon={ClipboardList} title="No check-ins yet" description="Activity will appear here once mentors start logging." />
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );

  const meta = sectionMeta[activeSection];
  const pageStats = pageStatsBySection[activeSection];

  return (
    <div className="space-y-4">
      <SectionCard className="overflow-hidden">
        <div className="border-b border-[#e5e5e5] p-4 lg:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#737373]">{meta.eyebrow}</p>
              <h2 className="mt-1 text-2xl font-semibold text-[#171717]">{meta.title}</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-[#525252]">{meta.description}</p>
            </div>
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#e5e5e5] bg-[#f5f5f5] px-3 py-1.5 text-xs font-medium text-[#525252]">
              <Activity className="h-3.5 w-3.5 text-[#2563eb]" />
              Live mentorship data
            </div>
          </div>
          {onNavigate && (
            <div className="mt-4 flex flex-wrap gap-2">
              {sectionNav.map(item => {
                const Icon = item.icon;
                const isActive = item.section === activeSection;
                return (
                  <button
                    key={item.view}
                    type="button"
                    onClick={() => onNavigate(item.view)}
                    className={`tbo-focus inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                      isActive
                        ? 'border-[#171717] bg-[#171717] text-white'
                        : 'border-[#e5e5e5] bg-white text-[#525252] hover:border-[#d4d4d4] hover:text-[#171717]'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <PageStatGrid stats={pageStats} />
      </SectionCard>

      {activeSection === 'overview' && renderOverview()}
      {activeSection === 'assignments' && (
        <MentorshipAssignmentsPanel
          users={users}
          courseStudents={courseStudents}
          courses={courses}
          mentorshipLogs={mentorshipLogs}
          getUserById={getUserById}
          getCourseDisplayName={getCourseDisplayName}
          onAssignMentor={onAssignMentor}
          onOpenCheckin={onOpenCheckin}
        />
      )}
      {activeSection === 'follow-up' && (
        <MentorshipFollowUpPanel
          users={users}
          courseStudents={courseStudents}
          cadenceSettings={cadenceSettings}
          mentorshipLogs={mentorshipLogs}
          getUserById={getUserById}
          onOpenCheckin={onOpenCheckin}
        />
      )}
      {activeSection === 'check-in-rules' && (
        <MentorshipCadencePanel
          cadenceSettings={cadenceSettings}
          setCadenceSettings={setCadenceSettings}
        />
      )}
    </div>
  );
}
