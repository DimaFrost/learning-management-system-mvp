import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Edit3,
  HeartHandshake,
  MessageCircle,
  Search,
  Sparkles,
  UserCheck,
  Users,
} from 'lucide-react';
import type { CadenceSettings } from '../../hooks/useCadenceSettings';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import type { User, Course, CourseStudent, MentorshipLog } from '../../types/lms';
import { isCourseActive } from '../../utils/courseUtils';
import { formatPlatformDate } from '../../utils/dateUtils';
import { calculateOverallStatus, getCheckInStatus } from '../../utils/mentorshipUtils';
import { ActiveYearGroupBadge, UserAvatar } from '../admin/users/usersShared';
import { getEngagementLabel } from '../admin/mentorshipShared';

interface MentorDashboardProps {
  currentUser: User;
  courseStudents: CourseStudent[];
  courses: Course[];
  mentorshipLogs: MentorshipLog[];
  cadenceSettings: CadenceSettings;
  getUserById: (id: string | null) => User | undefined;
  getCourseDisplayName: (course: Course) => string;
  onOpenCheckin: (studentId: string, existingLog?: MentorshipLog) => void;
}

type MenteeStatus = 'at_risk' | 'lagging' | 'on_track';
type FilterKey = 'all' | MenteeStatus;

type MenteeSummary = {
  studentId: string;
  student: User | undefined;
  courses: Course[];
  enrollments: CourseStudent[];
  logs: MentorshipLog[];
  recentLogs: MentorshipLog[];
  latestLog?: MentorshipLog;
  lastInPerson?: MentorshipLog;
  status: MenteeStatus;
  inPersonMessage: string;
  inPersonDays: number | null;
  engagement?: string;
};

const STATUS_META: Record<MenteeStatus, {
  labelKey: TranslationKey;
  card: string;
  pill: string;
  icon: typeof CheckCircle2;
  progress: string;
}> = {
  at_risk: {
    labelKey: 'common.needsAttention',
    card: 'border-[#fecaca] bg-[#fffafa]',
    pill: 'border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]',
    icon: AlertTriangle,
    progress: 'bg-[#dc2626]',
  },
  lagging: {
    labelKey: 'mentor.dashboard.status.followUpSoon',
    card: 'border-[#fde68a] bg-[#fffdf4]',
    pill: 'border-[#fde68a] bg-[#fffbeb] text-[#b45309]',
    icon: Clock3,
    progress: 'bg-[#f59e0b]',
  },
  on_track: {
    labelKey: 'mentorship.status.onTrack',
    card: 'border-[#bbf7d0] bg-[#fbfffc]',
    pill: 'border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]',
    icon: CheckCircle2,
    progress: 'bg-[#16a34a]',
  },
};

function getDaysSince(date: string | undefined) {
  if (!date) return null;
  const start = new Date(`${date}T00:00:00`).getTime();
  if (Number.isNaN(start)) return null;
  return Math.max(0, Math.floor((Date.now() - start) / 86_400_000));
}

function getThisMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getEngagementTone(engagement: string | undefined) {
  if (engagement === 'very_high' || engagement === 'excellent') return 'text-[#15803d] bg-[#f0fdf4] border-[#bbf7d0]';
  if (engagement === 'good') return 'text-[#1d4ed8] bg-[#eff6ff] border-[#bfdbfe]';
  if (engagement === 'moderate' || engagement === 'needs_improvement') return 'text-[#b45309] bg-[#fffbeb] border-[#fde68a]';
  if (engagement === 'low' || engagement === 'concern') return 'text-[#b91c1c] bg-[#fef2f2] border-[#fecaca]';
  return 'text-[#737373] bg-[#fafafa] border-[#e5e5e5]';
}

function getProgressFromStatus(status: MenteeStatus) {
  if (status === 'on_track') return 100;
  if (status === 'lagging') return 58;
  return 24;
}

function StatCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: typeof UserCheck;
  label: string;
  value: string | number;
  detail: string;
  tone: string;
}) {
  return (
    <div className="border border-[#e5e5e5] bg-white px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#737373]">{label}</p>
          <p className="mt-2 text-2xl font-semibold leading-none text-[#171717]">{value}</p>
        </div>
        <span className={`grid h-9 w-9 place-items-center rounded-full ${tone}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-2 text-xs leading-5 text-[#737373]">{detail}</p>
    </div>
  );
}

function EmptyMentorState() {
  const { t } = useLanguage();
  return (
    <div className="rounded-2xl border border-dashed border-[#d4d4d4] bg-white px-6 py-14 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#f0fdf4] text-[#15803d] ring-1 ring-[#bbf7d0]">
        <HeartHandshake className="h-5 w-5" />
      </span>
      <p className="mt-4 text-base font-semibold text-[#171717]">{t('mentor.dashboard.empty.title')}</p>
      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-[#737373]">
        {t('mentor.dashboard.empty.desc')}
      </p>
    </div>
  );
}

export function MentorDashboard({
  currentUser,
  courseStudents,
  courses,
  mentorshipLogs,
  cadenceSettings,
  getUserById,
  getCourseDisplayName,
  onOpenCheckin,
}: MentorDashboardProps) {
  const { t, tCount, language } = useLanguage();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');

  const activeCourseIds = useMemo(
    () => new Set(courses.filter(isCourseActive).map(course => course.id)),
    [courses]
  );

  const myLogs = useMemo(
    () => mentorshipLogs.filter(log => log.mentorId === currentUser.id),
    [currentUser.id, mentorshipLogs]
  );

  const mentees = useMemo<MenteeSummary[]>(() => {
    const mentorEnrollments = courseStudents.filter(enrollment =>
      enrollment.mentorId === currentUser.id &&
      enrollment.status === 'active' &&
      activeCourseIds.has(enrollment.courseId)
    );

    const byStudent = new Map<string, Omit<MenteeSummary, 'logs' | 'recentLogs' | 'status' | 'inPersonMessage' | 'inPersonDays'>>();

    mentorEnrollments.forEach(enrollment => {
      const course = courses.find(item => item.id === enrollment.courseId);
      const existing = byStudent.get(enrollment.studentId);
      if (existing) {
        if (course) existing.courses.push(course);
        existing.enrollments.push(enrollment);
        return;
      }
      byStudent.set(enrollment.studentId, {
        studentId: enrollment.studentId,
        student: getUserById(enrollment.studentId),
        courses: course ? [course] : [],
        enrollments: [enrollment],
        latestLog: undefined,
        lastInPerson: undefined,
        engagement: undefined,
      });
    });

    return Array.from(byStudent.values()).map(item => {
      const logs = myLogs
        .filter(log => log.studentId === item.studentId)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const latestLog = logs[0];
      const lastInPerson = logs.find(log => log.type === 'in_person');
      const inPersonStatus = getCheckInStatus(item.studentId, 'in_person', myLogs, cadenceSettings);
      const status = calculateOverallStatus(item.studentId, myLogs, cadenceSettings);
      const engagement = latestLog?.engagement ?? latestLog?.studentProgress;

      return {
        ...item,
        logs,
        recentLogs: logs.slice(0, 3),
        latestLog,
        lastInPerson,
        status,
        inPersonMessage: inPersonStatus.message,
        inPersonDays: inPersonStatus.daysSince,
        engagement,
      };
    }).sort((a, b) => {
      const priority = { at_risk: 0, lagging: 1, on_track: 2 };
      const byPriority = priority[a.status] - priority[b.status];
      if (byPriority !== 0) return byPriority;
      return (b.inPersonDays ?? -1) - (a.inPersonDays ?? -1);
    });
  }, [activeCourseIds, cadenceSettings, courseStudents, courses, currentUser.id, getUserById, language, myLogs]);

  const filteredMentees = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return mentees
      .filter(mentee => filter === 'all' || mentee.status === filter)
      .filter(mentee => {
        if (!normalized) return true;
        const courseText = mentee.courses.map(getCourseDisplayName).join(' ');
        return `${mentee.student?.name ?? ''} ${courseText} ${mentee.engagement ?? ''}`.toLowerCase().includes(normalized);
      });
  }, [filter, getCourseDisplayName, mentees, query]);

  const thisMonth = getThisMonthKey();
  const thisMonthLogs = myLogs.filter(log => log.meetingMonth === thisMonth || log.date.startsWith(thisMonth));
  const atRiskCount = mentees.filter(mentee => mentee.status === 'at_risk').length;
  const laggingCount = mentees.filter(mentee => mentee.status === 'lagging').length;
  const onTrackCount = mentees.filter(mentee => mentee.status === 'on_track').length;
  const attentionQueue = mentees.filter(mentee => mentee.status !== 'on_track').slice(0, 4);
  const recentLogs = myLogs
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 6);
  const healthPercent = mentees.length === 0 ? 100 : Math.round((onTrackCount / mentees.length) * 100);

  const filterCounts: Record<FilterKey, number> = {
    all: mentees.length,
    at_risk: atRiskCount,
    lagging: laggingCount,
    on_track: onTrackCount,
  };

  return (
    <div className="space-y-5">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="overflow-hidden rounded-2xl border border-[#e5e5e5] bg-white">
          <div className="relative border-b border-[#eeeeee] px-5 py-4">
            <div className="flex flex-col gap-4 lg:block lg:pr-48">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#15803d]">{t('mentor.dashboard.eyebrow')}</p>
                <h1 className="tbo-display mt-1 text-3xl text-[#171717]">{t('mentor.dashboard.title')}</h1>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-[#737373]">
                  {t('mentor.dashboard.subtitle')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => filteredMentees[0] && onOpenCheckin(filteredMentees[0].studentId)}
                disabled={filteredMentees.length === 0}
                className="tbo-focus inline-flex h-10 w-fit items-center gap-2 rounded-xl bg-[#171717] px-4 text-sm font-semibold text-white hover:bg-[#262626] disabled:cursor-not-allowed disabled:opacity-40 lg:absolute lg:right-5 lg:top-4"
              >
                <Edit3 className="h-4 w-4" />
                {t('mentor.dashboard.logCheckin')}
              </button>
            </div>
          </div>

          <div className="grid gap-px bg-[#e5e5e5] sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={Users}
              label={t('mentor.dashboard.myStudents')}
              value={mentees.length}
              detail={tCount('mentor.dashboard.checkinsCount', myLogs.length)}
              tone="bg-[#f0fdf4] text-[#15803d]"
            />
            <StatCard
              icon={AlertTriangle}
              label={t('common.needsAttention')}
              value={atRiskCount + laggingCount}
              detail={t('mentor.dashboard.needsAttention.detail', { urgent: atRiskCount, approaching: laggingCount })}
              tone="bg-[#fff7ed] text-[#c2410c]"
            />
            <StatCard
              icon={MessageCircle}
              label={t('mentor.dashboard.thisMonth')}
              value={thisMonthLogs.length}
              detail={t('mentor.dashboard.thisMonth.detail')}
              tone="bg-[#eff6ff] text-[#2563eb]"
            />
            <StatCard
              icon={Sparkles}
              label={t('mentorship.hub.followUpHealth')}
              value={`${healthPercent}%`}
              detail={t('mentor.dashboard.followUpHealth.detail', { onTrack: onTrackCount, total: mentees.length || 0 })}
              tone="bg-[#fafafa] text-[#525252]"
            />
          </div>
        </div>

        <aside className="rounded-2xl border border-[#e5e5e5] bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[#171717]">{t('mentor.dashboard.inPersonRhythm')}</p>
              <p className="mt-1 text-xs leading-5 text-[#737373]">{t('mentor.dashboard.inPersonExpectations.desc')}</p>
            </div>
            <span className="grid h-9 min-h-[36px] w-9 min-w-[36px] shrink-0 place-items-center rounded-full bg-[#f0fdf4] text-[#15803d] ring-1 ring-[#bbf7d0]">
              <CalendarClock className="h-4 w-4" />
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {[
              { key: 'expected', labelKey: 'mentorship.cadence.step.expected.title' as const, value: cadenceSettings.inPerson.expectedDays, tone: 'bg-[#dcfce7] text-[#166534]' },
              { key: 'lagging', labelKey: 'mentorship.status.lagging' as const, value: cadenceSettings.inPerson.warningDays, tone: 'bg-[#fef3c7] text-[#92400e]' },
              { key: 'at_risk', labelKey: 'mentorship.status.atRisk' as const, value: cadenceSettings.inPerson.criticalDays, tone: 'bg-[#fee2e2] text-[#991b1b]' },
            ].map(item => (
              <div key={item.key} className="flex items-center justify-between rounded-xl border border-[#eeeeee] bg-[#fafafa] px-3 py-2">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#737373]">{t(item.labelKey)}</span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.tone}`}>{tCount('admin.dashboard.days', item.value)}</span>
              </div>
            ))}
          </div>
        </aside>
      </section>

      {mentees.length === 0 ? (
        <EmptyMentorState />
      ) : (
        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#e5e5e5] bg-white">
              <div className="grid gap-3 border-b border-[#eeeeee] px-4 py-3 lg:grid-cols-[minmax(240px,1fr)_auto] lg:items-center">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a3a3a3]" />
                  <input
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                    placeholder={t('mentor.dashboard.searchPlaceholder')}
                    className="tbo-focus h-10 w-full rounded-xl border border-[#d4d4d4] bg-white pl-9 pr-3 text-sm text-[#171717]"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  {([
                    ['all', 'common.all'],
                    ['at_risk', 'mentor.dashboard.filter.urgent'],
                    ['lagging', 'mentor.dashboard.filter.soon'],
                    ['on_track', 'mentor.dashboard.filter.clear'],
                  ] as Array<[FilterKey, TranslationKey]>).map(([key, labelKey]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFilter(key)}
                      className={`tbo-focus inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition ${
                        filter === key
                          ? 'border-[#171717] bg-[#171717] text-white'
                          : 'border-[#e5e5e5] bg-[#fafafa] text-[#525252] hover:bg-white'
                      }`}
                    >
                      {t(labelKey)}
                      <span className={`rounded-full px-1.5 py-0.5 ${filter === key ? 'bg-white/20' : 'bg-white text-[#737373]'}`}>
                        {filterCounts[key]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="divide-y divide-[#eeeeee]">
                {filteredMentees.length === 0 ? (
                  <p className="px-5 py-10 text-center text-sm text-[#737373]">{t('mentor.dashboard.noMatch')}</p>
                ) : filteredMentees.map(mentee => {
                  const meta = STATUS_META[mentee.status];
                  const StatusIcon = meta.icon;
                  const progress = getProgressFromStatus(mentee.status);

                  return (
                    <article key={mentee.studentId} className={`grid gap-4 px-4 py-4 transition hover:bg-[#fafafa] lg:grid-cols-[minmax(0,1fr)_220px] ${meta.card}`}>
                      <div className="min-w-0">
                        <div className="flex items-start gap-3">
                          {mentee.student ? <UserAvatar user={mentee.student} /> : <span className="h-10 w-10 rounded-full bg-[#f5f5f5]" />}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="truncate text-base font-semibold text-[#171717]">{mentee.student?.name ?? t('mentorship.hub.unknownStudent')}</h2>
                              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${meta.pill}`}>
                                <StatusIcon className="h-3.5 w-3.5" />
                                {t(meta.labelKey)}
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              {mentee.courses.map(course => (
                                <ActiveYearGroupBadge key={course.id} course={course} />
                              ))}
                              <span className="text-xs font-medium text-[#737373]">{tCount('mentor.dashboard.checkinsCount', mentee.logs.length)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                          <div className="rounded-xl border border-[#eeeeee] bg-white px-3 py-2">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{t('mentorship.followUp.column.lastInPerson')}</p>
                            <p className="mt-1 text-sm font-semibold text-[#171717]">
                              {mentee.lastInPerson ? formatPlatformDate(mentee.lastInPerson.date) : t('mentorship.assignments.noneYet')}
                            </p>
                            <p className="mt-0.5 text-xs text-[#737373]">{mentee.inPersonMessage}</p>
                          </div>
                          <div className="rounded-xl border border-[#eeeeee] bg-white px-3 py-2">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{t('mentor.dashboard.latestNote')}</p>
                            <p className="mt-1 line-clamp-2 text-sm text-[#525252]">
                              {mentee.latestLog?.mainTopic || mentee.latestLog?.notes || t('mentor.dashboard.noNotesYet')}
                            </p>
                          </div>
                          <div className="rounded-xl border border-[#eeeeee] bg-white px-3 py-2">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{t('mentor.dashboard.engagement')}</p>
                            <span className={`mt-1 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getEngagementTone(mentee.engagement)}`}>
                              {mentee.engagement ? getEngagementLabel(mentee.engagement) : t('mentor.dashboard.noData')}
                            </span>
                          </div>
                        </div>

                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#f0f0f0]">
                          <div className={`h-full rounded-full ${meta.progress}`} style={{ width: `${progress}%` }} />
                        </div>
                      </div>

                      <div className="flex flex-col justify-between gap-3 lg:items-end">
                        <div className="text-left lg:text-right">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{t('mentor.dashboard.assigned')}</p>
                          <p className="mt-1 text-sm font-semibold text-[#171717]">
                            {formatPlatformDate(mentee.enrollments[0]?.enrollmentDate)}
                          </p>
                          <p className="mt-1 text-xs text-[#737373]">
                            {mentee.courses.map(getCourseDisplayName).join(', ')}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onOpenCheckin(mentee.studentId)}
                          className="tbo-focus inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-[#171717] bg-white px-3 text-sm font-semibold text-[#171717] hover:bg-[#171717] hover:text-white"
                        >
                          <Edit3 className="h-4 w-4" />
                          {t('mentor.dashboard.logCheckin')}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-[#e5e5e5] bg-white">
              <div className="border-b border-[#eeeeee] px-4 py-3">
                <p className="text-sm font-semibold text-[#171717]">{t('mentorship.followUp.priority.title')}</p>
                <p className="mt-1 text-xs text-[#737373]">{t('mentor.dashboard.priority.desc')}</p>
              </div>
              <div className="max-h-[360px] space-y-2 overflow-y-auto p-3 tbo-scrollbar">
                {attentionQueue.length === 0 ? (
                  <div className="rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-4 text-sm text-[#166534]">
                    {t('mentor.dashboard.priority.clear')}
                  </div>
                ) : attentionQueue.map(mentee => {
                  const meta = STATUS_META[mentee.status];
                  const StatusIcon = meta.icon;
                  return (
                    <button
                      key={mentee.studentId}
                      type="button"
                      onClick={() => onOpenCheckin(mentee.studentId)}
                      className="tbo-focus flex w-full items-center gap-3 rounded-xl border border-[#eeeeee] bg-[#fafafa] px-3 py-2 text-left hover:bg-white"
                    >
                      {mentee.student ? <UserAvatar user={mentee.student} size="sm" /> : <span className="h-8 w-8 rounded-full bg-white" />}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-[#171717]">{mentee.student?.name ?? t('mentorship.hub.unknownStudent')}</span>
                        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-[#737373]">
                          <StatusIcon className="h-3.5 w-3.5" />
                          {mentee.inPersonMessage}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-2xl border border-[#e5e5e5] bg-white">
              <div className="border-b border-[#eeeeee] px-4 py-3">
                <p className="text-sm font-semibold text-[#171717]">{t('mentor.dashboard.recentCheckins')}</p>
                <p className="mt-1 text-xs text-[#737373]">{t('mentor.dashboard.recentCheckins.desc')}</p>
              </div>
              <div className="max-h-[420px] overflow-y-auto p-3 tbo-scrollbar">
                {recentLogs.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-[#d4d4d4] bg-[#fafafa] px-3 py-6 text-center text-sm text-[#737373]">
                    {t('mentor.dashboard.noRecentCheckins')}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {recentLogs.map(log => {
                      const student = getUserById(log.studentId);
                      const typeLabel = log.type === 'in_person'
                        ? t('mentorship.hub.checkin.inPerson')
                        : t('mentorship.hub.checkin.digital');
                      return (
                        <article key={log.id} className="rounded-xl border border-[#eeeeee] bg-[#fafafa] p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-2">
                              {student ? <UserAvatar user={student} size="sm" /> : <span className="h-8 w-8 rounded-full bg-white" />}
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-[#171717]">{student?.name ?? t('mentorship.hub.unknownStudent')}</p>
                                <p className="text-xs text-[#737373]">{typeLabel} - {formatPlatformDate(log.date)}</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => onOpenCheckin(log.studentId, log)}
                              className="tbo-focus grid h-8 w-8 place-items-center rounded-full border border-[#e5e5e5] bg-white text-[#737373] hover:text-[#171717]"
                              title={t('mentor.dashboard.editCheckinTitle')}
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <p className="mt-3 line-clamp-3 text-sm leading-6 text-[#525252]">
                            {log.mainTopic || log.notes || t('mentor.dashboard.noData')}
                          </p>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          </aside>
        </section>
      )}
    </div>
  );
}
