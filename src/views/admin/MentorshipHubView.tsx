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
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
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

const sectionMetaKeys: Record<MentorshipSection, { title: TranslationKey; eyebrow: TranslationKey; description: TranslationKey }> = {
  overview: {
    title: 'mentorship.hub.section.overview.title',
    eyebrow: 'mentorship.hub.section.overview.eyebrow',
    description: 'mentorship.hub.section.overview.desc',
  },
  assignments: {
    title: 'mentorship.hub.section.assignments.title',
    eyebrow: 'mentorship.hub.section.assignments.eyebrow',
    description: 'mentorship.hub.section.assignments.desc',
  },
  'follow-up': {
    title: 'mentorship.hub.section.followUp.title',
    eyebrow: 'mentorship.hub.section.followUp.eyebrow',
    description: 'mentorship.hub.section.followUp.desc',
  },
  'check-in-rules': {
    title: 'mentorship.hub.section.checkInRules.title',
    eyebrow: 'mentorship.hub.section.checkInRules.eyebrow',
    description: 'mentorship.hub.section.checkInRules.desc',
  },
};

const sectionNavConfig: Array<{
  section: MentorshipSection;
  view: string;
  labelKey: TranslationKey;
  icon: typeof Activity;
}> = [
  { section: 'overview', view: 'mentorship-overview', labelKey: 'mentorship.hub.nav.overview', icon: Activity },
  { section: 'assignments', view: 'mentorship-assignments', labelKey: 'mentorship.hub.nav.assignments', icon: UserCheck },
  { section: 'follow-up', view: 'mentorship-follow-up', labelKey: 'mentorship.hub.nav.followUp', icon: AlertTriangle },
  { section: 'check-in-rules', view: 'mentorship-check-in-rules', labelKey: 'mentorship.hub.nav.checkInRules', icon: Settings },
];

const quickLinkConfig: Array<{
  section: MentorshipSection;
  view: string;
  titleKey: TranslationKey;
  descriptionKey: TranslationKey;
  icon: typeof Activity;
}> = [
  { section: 'assignments', view: 'mentorship-assignments', titleKey: 'mentorship.hub.quick.assignments.title', descriptionKey: 'mentorship.hub.quick.assignments.desc', icon: UserCheck },
  { section: 'follow-up', view: 'mentorship-follow-up', titleKey: 'mentorship.hub.quick.followUp.title', descriptionKey: 'mentorship.hub.quick.followUp.desc', icon: AlertTriangle },
  { section: 'check-in-rules', view: 'mentorship-check-in-rules', titleKey: 'mentorship.hub.quick.checkInRules.title', descriptionKey: 'mentorship.hub.quick.checkInRules.desc', icon: Settings },
];

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
  const { t } = useLanguage();
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
        studentName: getUserById(log.studentId)?.name ?? t('mentorship.hub.unknownStudent'),
        mentorName: getUserById(log.mentorId)?.name ?? t('mentorship.hub.unknownMentor'),
      }));
  }, [getUserById, mentorshipLogs, t]);

  const attentionList = useMemo(() => {
    const atRisk = Array.from(new Set(assignedPairs.map(pair => pair.studentId)))
      .filter(studentId => calculateOverallStatus(studentId, mentorshipLogs, cadenceSettings) === 'at_risk')
      .map(studentId => ({
        id: studentId,
        name: getUserById(studentId)?.name ?? t('common.unknown'),
        kind: 'at_risk' as const,
      }));

    const unassigned = studentsWithoutMentor.map(studentId => ({
      id: studentId,
      name: getUserById(studentId)?.name ?? t('common.unknown'),
      kind: 'unassigned' as const,
    }));

    return [...atRisk, ...unassigned].slice(0, 8);
  }, [assignedPairs, cadenceSettings, getUserById, mentorshipLogs, studentsWithoutMentor, t]);

  const pageStatsBySection = useMemo(() => ({
    overview: [
      { label: t('mentorship.hub.stat.activePairs'), value: assignedPairs.length, detail: t('mentorship.hub.stat.mentorsAvailable', { count: activeMentors.length }), icon: Users, accent: 'bg-[#dbeaff] text-[#2563eb]' },
      { label: t('mentorship.hub.stat.coverage'), value: `${coveragePercent}%`, detail: t('mentorship.hub.stat.stillUnassigned', { count: studentsWithoutMentor.length }), icon: UserCheck, accent: coveragePercent >= 90 ? 'bg-[#dcfce7] text-[#16a34a]' : 'bg-[#fff7ed] text-[#ea580c]' },
      { label: t('mentorship.hub.stat.atRisk'), value: statusCounts.atRisk, detail: t('mentorship.hub.stat.laggingCount', { count: statusCounts.lagging }), icon: AlertTriangle, accent: 'bg-[#fee2e2] text-[#dc2626]' },
      { label: t('mentorship.hub.stat.thisWeek'), value: recentCheckIns, detail: t('mentorship.hub.stat.checkinsLogged'), icon: Activity, accent: 'bg-[#f3e8ff] text-[#7c3aed]' },
    ],
    assignments: [
      { label: t('mentorship.hub.stat.activePairs'), value: assignedPairs.length, detail: t('mentorship.hub.stat.studentsWithMentors'), icon: UserCheck, accent: 'bg-[#dbeaff] text-[#2563eb]' },
      { label: t('mentorship.hub.stat.needsMentor'), value: studentsWithoutMentor.length, detail: t('mentorship.hub.stat.awaitingAssignment'), icon: AlertTriangle, accent: 'bg-[#fff7ed] text-[#ea580c]' },
      { label: t('mentorship.hub.stat.avgCheckins'), value: avgCheckIns, detail: t('mentorship.hub.stat.perAssignedPair'), icon: ClipboardList, accent: 'bg-[#f3e8ff] text-[#7c3aed]' },
      { label: t('mentorship.hub.stat.thisWeek'), value: recentCheckIns, detail: t('mentorship.hub.stat.newLogs'), icon: Calendar, accent: 'bg-[#dcfce7] text-[#16a34a]' },
    ],
    'follow-up': [
      { label: t('mentorship.hub.stat.atRisk'), value: statusCounts.atRisk, detail: t('mentorship.hub.stat.needImmediateFollowUp'), icon: AlertTriangle, accent: 'bg-[#fee2e2] text-[#dc2626]' },
      { label: t('mentorship.status.lagging'), value: statusCounts.lagging, detail: t('mentorship.hub.stat.approachingThresholds'), icon: Activity, accent: 'bg-[#fff7ed] text-[#ea580c]' },
      { label: t('mentorship.status.onTrack'), value: statusCounts.onTrack, detail: t('mentorship.hub.stat.meetingExpectations'), icon: CheckCircle2, accent: 'bg-[#dcfce7] text-[#16a34a]' },
      { label: t('mentorship.hub.stat.trackedPairs'), value: statusCounts.tracked, detail: t('mentorship.hub.stat.trackedStudents'), icon: Users, accent: 'bg-[#dbeaff] text-[#2563eb]' },
    ],
    'check-in-rules': [
      { label: t('mentorship.hub.stat.expectedGap'), value: `${cadenceSettings.inPerson.expectedDays}d`, detail: t('mentorship.hub.stat.betweenInPerson'), icon: Users, accent: 'bg-[#dcfce7] text-[#16a34a]' },
      { label: t('mentorship.hub.stat.warning'), value: `${cadenceSettings.inPerson.warningDays}d`, detail: t('mentorship.hub.stat.showsAsLagging'), icon: Activity, accent: 'bg-[#fff7ed] text-[#ea580c]' },
      { label: t('mentorship.hub.stat.critical'), value: `${cadenceSettings.inPerson.criticalDays}d`, detail: t('mentorship.hub.stat.showsAsAtRisk'), icon: AlertTriangle, accent: 'bg-[#fee2e2] text-[#dc2626]' },
      { label: t('mentorship.hub.stat.trackedPairs'), value: statusCounts.tracked, detail: t('mentorship.hub.stat.inPersonRulesOnly'), icon: UserCheck, accent: 'bg-[#dbeaff] text-[#2563eb]' },
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
    t,
  ]);

  const statusTotal = Math.max(statusCounts.tracked, 1);

  const renderOverview = () => (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard className="p-4 lg:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-[#171717]">{t('mentorship.hub.coverage.title')}</h3>
              <p className="mt-1 text-sm text-[#737373]">
                {t('mentorship.hub.coverage.summary', {
                  assigned: activeStudents.length - studentsWithoutMentor.length,
                  total: activeStudents.length,
                })}
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
              <p className="mt-1 text-xs font-medium text-[#991b1b]">{t('mentorship.status.atRisk')}</p>
            </div>
            <div className="rounded-xl bg-[#fffbeb] p-3 text-center ring-1 ring-[#fde68a]">
              <p className="text-xl font-semibold text-[#b45309]">{statusCounts.lagging}</p>
              <p className="mt-1 text-xs font-medium text-[#92400e]">{t('mentorship.status.lagging')}</p>
            </div>
            <div className="rounded-xl bg-[#f0fdf4] p-3 text-center ring-1 ring-[#bbf7d0]">
              <p className="text-xl font-semibold text-[#15803d]">{statusCounts.onTrack}</p>
              <p className="mt-1 text-xs font-medium text-[#166534]">{t('mentorship.status.onTrack')}</p>
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between text-xs text-[#737373]">
              <span>{t('mentorship.hub.followUpHealth')}</span>
              <span>{t('mentorship.hub.studentsCount', { count: statusCounts.tracked })}</span>
            </div>
            <div className="flex h-3 overflow-hidden rounded-full bg-[#f0f0f0]">
              <div className="bg-[#dc2626]" style={{ width: `${(statusCounts.atRisk / statusTotal) * 100}%` }} />
              <div className="bg-[#f59e0b]" style={{ width: `${(statusCounts.lagging / statusTotal) * 100}%` }} />
              <div className="bg-[#16a34a]" style={{ width: `${(statusCounts.onTrack / statusTotal) * 100}%` }} />
            </div>
          </div>
        </SectionCard>

        <SectionCard className="p-4 lg:p-5">
          <h3 className="font-semibold text-[#171717]">{t('mentorship.hub.inPersonRules.title')}</h3>
          <p className="mt-1 text-sm text-[#737373]">
            {t('mentorship.hub.inPersonRules.desc')}
          </p>
          <div className="mt-4 rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] p-4">
            <div className="flex items-center gap-2 text-[#15803d]">
              <Users className="h-4 w-4" />
              <span className="text-sm font-semibold">{t('mentorship.hub.inPersonMeetings')}</span>
            </div>
            <p className="mt-2 text-sm leading-6 text-[#525252]">
              {t('mentorship.hub.expectedEvery', { days: cadenceSettings.inPerson.expectedDays })}
              <br />
              {t('mentorship.hub.laggingAfter', { days: cadenceSettings.inPerson.warningDays })} · {t('mentorship.hub.atRiskAfter', { days: cadenceSettings.inPerson.criticalDays })}
            </p>
          </div>
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('mentorship-check-in-rules')}
              className="tbo-focus mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#2563eb] hover:text-[#1d4ed8]"
            >
              {t('mentorship.hub.editCheckInRules')}
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </SectionCard>
      </div>

      {onNavigate && (
        <div className="grid gap-3 sm:grid-cols-3">
          {quickLinkConfig.map(link => {
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
                <p className="mt-3 font-semibold text-[#171717]">{t(link.titleKey)}</p>
                <p className="mt-1 text-sm text-[#737373]">{t(link.descriptionKey)}</p>
              </button>
            );
          })}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard className="overflow-hidden">
          <div className="border-b border-[#e5e5e5] px-4 py-3">
            <h3 className="font-semibold text-[#171717]">{t('mentorship.hub.needsAttention.title')}</h3>
            <p className="text-sm text-[#737373]">{t('mentorship.hub.needsAttention.desc')}</p>
          </div>
          <div className="divide-y divide-[#f0f0f0]">
            {attentionList.length > 0 ? attentionList.map(item => (
              <div key={`${item.kind}-${item.id}`} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <PersonAvatar name={item.name} tone={item.kind === 'unassigned' ? 'alert' : 'student'} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[#171717]">{item.name}</p>
                    <p className="text-xs text-[#737373]">
                      {item.kind === 'unassigned' ? t('mentorship.hub.noMentorAssigned') : t('mentorship.hub.checkInOverdue')}
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
                      {t('mentorship.hub.assign')}
                    </button>
                  )
                ) : (
                  <OverallStatusBadge status="at_risk" />
                )}
              </div>
            )) : (
              <div className="px-4 py-8 text-center text-sm text-[#737373]">
                <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-[#16a34a]" />
                {t('mentorship.hub.allClear')}
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard className="overflow-hidden">
          <div className="border-b border-[#e5e5e5] px-4 py-3">
            <h3 className="font-semibold text-[#171717]">{t('mentorship.hub.recentCheckins.title')}</h3>
            <p className="text-sm text-[#737373]">{t('mentorship.hub.recentCheckins.desc')}</p>
          </div>
          <div className="divide-y divide-[#f0f0f0]">
            {recentActivity.length > 0 ? recentActivity.map(log => (
              <div key={log.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-[#171717]">{log.studentName}</p>
                  <p className="mt-0.5 text-xs text-[#737373]">
                    {log.type === 'digital' ? t('mentorship.hub.checkin.digital') : t('mentorship.hub.checkin.inPerson')} · {log.mentorName}
                  </p>
                  {(log.mainTopic || log.notes) && (
                    <p className="mt-1 line-clamp-2 text-xs text-[#525252]">{log.mainTopic || log.notes}</p>
                  )}
                </div>
                <span className="shrink-0 text-xs text-[#737373]">{formatPlatformDate(log.date)}</span>
              </div>
            )) : (
              <EmptyState icon={ClipboardList} title={t('mentorship.hub.noCheckinsYet')} description={t('mentorship.hub.noCheckinsDesc')} />
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );

  const meta = sectionMetaKeys[activeSection];
  const pageStats = pageStatsBySection[activeSection];

  return (
    <div className="space-y-4">
      <SectionCard className="overflow-hidden">
        <div className="border-b border-[#e5e5e5] p-4 lg:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#737373]">{t(meta.eyebrow)}</p>
              <h2 className="mt-1 text-2xl font-semibold text-[#171717]">{t(meta.title)}</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-[#525252]">{t(meta.description)}</p>
            </div>
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#e5e5e5] bg-[#f5f5f5] px-3 py-1.5 text-xs font-medium text-[#525252]">
              <Activity className="h-3.5 w-3.5 text-[#2563eb]" />
              {t('mentorship.hub.liveData')}
            </div>
          </div>
          {onNavigate && (
            <div className="mt-4 flex flex-wrap gap-2">
              {sectionNavConfig.map(item => {
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
                    {t(item.labelKey)}
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
