import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CalendarDays, CheckCircle2, ChevronDown, ChevronRight, ClipboardList, Search, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Class, Course, CourseStudent, User } from '../../types/lms';
import { ActiveYearGroupBadge, UserAvatar } from '../admin/users/usersShared';
import { formatPlatformDate } from '../../utils/dateUtils';

type AbsenceScope = 'admin' | 'student';

type NoticeRow = {
  id: number;
  student_id: string;
  reason: string | null;
  status: 'submitted' | 'acknowledged' | 'archived';
  submitted_at: string;
  student?: { id: string; name: string; email: string | null; avatar_url: string | null } | null;
  sessions?: {
    id: number;
    class_id: number;
    class?: {
      id: number;
      title: string;
      date: string;
      hour: Class['hour'];
      subject_id: number;
      subject?: { id: number; title: string; course_id: number | null } | null;
    } | null;
  }[] | null;
};

type SessionOption = {
  classId: number;
  title: string;
  subjectTitle: string;
  date: string;
  hour: Class['hour'];
  course: Course;
  isActivation: boolean;
};

interface AbsenceNoticesViewProps {
  scope: AbsenceScope;
  currentUser: User;
  courses: Course[];
  courseStudents: CourseStudent[];
  users: User[];
}

function todayKey() {
  return new Date().toISOString().split('T')[0];
}

function isSaturday(date: string) {
  return new Date(`${date}T00:00:00`).getDay() === 6;
}

function isActivationSession(cls: Class) {
  return cls.hour === 'both' && isSaturday(cls.date);
}

function getHourLabel(hour: Class['hour']) {
  if (hour === 'both') return 'Joint session';
  return hour === 'first' ? 'First session' : 'Second session';
}

function collectStudentSessions(currentUser: User, courses: Course[], courseStudents: CourseStudent[]) {
  const activeCourseIds = new Set(courseStudents
    .filter(row => row.studentId === currentUser.id && row.status === 'active')
    .map(row => row.courseId));
  return collectSessions(courses.filter(course => activeCourseIds.has(course.id)));
}

function collectSessions(courses: Course[]) {
  const today = todayKey();
  const sessions: SessionOption[] = [];
  courses.filter(course => course.status === 'active').forEach(course => {
    course.subjects.forEach(subject => {
      subject.classes.forEach(cls => {
        if (!cls.date || cls.date < today) return;
        sessions.push({
          classId: cls.id,
          title: cls.title,
          subjectTitle: subject.title,
          date: cls.date,
          hour: cls.hour,
          course,
          isActivation: isActivationSession(cls),
        });
      });
    });
  });
  return sessions.sort((a, b) => `${a.date}-${a.hour}`.localeCompare(`${b.date}-${b.hour}`));
}

function getNoticeSessionDate(notice: NoticeRow) {
  const dates = (notice.sessions ?? [])
    .map(item => item.class?.date)
    .filter((date): date is string => Boolean(date))
    .sort();
  return dates[0] ?? notice.submitted_at;
}

function getSessionCourse(session: NoticeRow['sessions'] extends Array<infer T> ? T : never, courses: Course[]) {
  const courseId = session.class?.subject?.course_id;
  return courses.find(course => course.id === courseId) ?? null;
}

export function AbsenceNoticesView({ scope, currentUser, courses, courseStudents, users }: AbsenceNoticesViewProps) {
  const [notices, setNotices] = useState<NoticeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedClassIds, setSelectedClassIds] = useState<Set<number>>(new Set());
  const [reason, setReason] = useState('');
  const [query, setQuery] = useState('');
  const [eventFilter, setEventFilter] = useState<'all' | number>('all');
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const sessionOptions = useMemo(
    () => scope === 'student' ? collectStudentSessions(currentUser, courses, courseStudents) : collectSessions(courses),
    [courseStudents, courses, currentUser, scope]
  );
  const nextFiveEvents = useMemo(() => sessionOptions.slice(0, 5), [sessionOptions]);

  const loadNotices = useCallback(async () => {
    setLoading(true);
    setError(null);
    let queryBuilder = supabase
      .from('absence_notices')
      .select(`
        id, student_id, reason, status, submitted_at,
        student:profiles!student_id(id, name, email, avatar_url),
        sessions:absence_notice_sessions(
          id, class_id,
          class:classes(
            id, title, date, hour, subject_id,
            subject:subjects(id, title, course_id)
          )
        )
      `)
      .order('submitted_at', { ascending: false });
    if (scope === 'student') {
      queryBuilder = queryBuilder.eq('student_id', currentUser.id);
    }
    const { data, error: loadError } = await queryBuilder;
    if (loadError) {
      console.error('Failed to load absence notices', loadError);
      setError('Failed to load absence notices.');
      setNotices([]);
    } else {
      setNotices((data ?? []) as NoticeRow[]);
    }
    setLoading(false);
  }, [currentUser.id, scope]);

  useEffect(() => {
    void loadNotices();
  }, [loadNotices]);

  const submitNotice = async () => {
    if (selectedClassIds.size === 0) {
      setError('Choose at least one session.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { data: notice, error: noticeError } = await supabase
        .from('absence_notices')
        .insert({
          student_id: currentUser.id,
          reason: reason.trim() || null,
        })
        .select('id')
        .single();
      if (noticeError) throw noticeError;

      const noticeId = Number(notice.id);
      const { error: sessionsError } = await supabase
        .from('absence_notice_sessions')
        .insert(Array.from(selectedClassIds).map(classId => ({
          notice_id: noticeId,
          class_id: classId,
        })));
      if (sessionsError) throw sessionsError;

      const { error: jobError } = await supabase.from('notification_jobs').insert({
        type: 'absence_notice_email',
        status: 'pending',
        scheduled_for: new Date().toISOString(),
        payload: { noticeId },
        created_by: currentUser.id,
      });
      if (jobError) console.error('Failed to queue absence notice email', jobError);

      setSelectedClassIds(new Set());
      setReason('');
      await loadNotices();
    } catch (err) {
      console.error(err);
      setError('Could not submit absence notice. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const filteredNotices = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return notices
      .filter(notice => {
        if (eventFilter === 'all') return true;
        return (notice.sessions ?? []).some(session => session.class_id === eventFilter);
      })
      .filter(notice => {
        if (!normalized) return true;
        const sessionText = (notice.sessions ?? [])
          .map(session => `${session.class?.title ?? ''} ${session.class?.subject?.title ?? ''}`)
          .join(' ');
        return `${notice.student?.name ?? ''} ${notice.student?.email ?? ''} ${notice.reason ?? ''} ${sessionText}`.toLowerCase().includes(normalized);
      })
      .sort((a, b) => getNoticeSessionDate(a).localeCompare(getNoticeSessionDate(b)));
  }, [eventFilter, notices, query]);

  const toggleSession = (classId: number) => {
    setSelectedClassIds(prev => {
      const next = new Set(prev);
      if (next.has(classId)) next.delete(classId);
      else next.add(classId);
      return next;
    });
  };

  const toggleNotice = (noticeId: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(noticeId)) next.delete(noticeId);
      else next.add(noticeId);
      return next;
    });
  };

  return (
    <div className="space-y-5">
      <section className="border-l-2 border-[#171717] pl-4">
        <div className="border-b border-[#d4d4d4] pb-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#737373]">Attendance communication</p>
          <h1 className="tbo-display mt-1 text-3xl text-[#171717]">Absence notices</h1>
          <p className="mt-1 text-sm text-[#737373]">
            {scope === 'student'
              ? 'Let the school know ahead of time when you expect to miss a session.'
              : 'Review student absence notices for upcoming classes and Activation Saturdays.'}
          </p>
        </div>
      </section>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm font-semibold text-[#b91c1c]">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {scope === 'student' && (
        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-2xl border border-[#e5e5e5] bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#171717]">Choose session(s)</p>
                <p className="mt-1 text-xs text-[#737373]">Only today and future sessions are available.</p>
              </div>
              <span className="rounded-full bg-[#fff7ed] px-3 py-1 text-xs font-semibold text-[#b06000] ring-1 ring-[#fce8b2]">
                {selectedClassIds.size} selected
              </span>
            </div>
            <div className="mt-4 grid gap-2">
              {sessionOptions.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[#d4d4d4] bg-[#fafafa] px-4 py-5 text-sm text-[#737373]">No upcoming sessions were found for your year group.</p>
              ) : sessionOptions.map(session => (
                <button
                  key={session.classId}
                  type="button"
                  onClick={() => toggleSession(session.classId)}
                  className={`tbo-focus grid gap-3 rounded-xl border px-4 py-3 text-left transition md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center ${
                    selectedClassIds.has(session.classId)
                      ? 'border-[#fce8b2] bg-[#fef7e0]'
                      : 'border-[#e5e5e5] bg-[#fafafa] hover:bg-white'
                  }`}
                >
                  <span className={`grid h-8 w-8 place-items-center rounded-full ${selectedClassIds.has(session.classId) ? 'bg-[#b06000] text-white' : 'bg-white text-[#737373] ring-1 ring-[#e5e5e5]'}`}>
                    {selectedClassIds.has(session.classId) ? <CheckCircle2 className="h-4 w-4" /> : <CalendarDays className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-[#171717]">{session.title}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#737373]">
                      <span>{formatPlatformDate(session.date)}</span>
                      <span>{getHourLabel(session.hour)}</span>
                      <span>{session.subjectTitle}</span>
                      {session.isActivation && <span className="font-semibold text-[#b06000]">Activation Saturday</span>}
                    </span>
                  </span>
                  <ActiveYearGroupBadge course={session.course} size="sm" />
                </button>
              ))}
            </div>
          </div>

          <aside className="space-y-3">
            <section className="rounded-2xl border border-[#e5e5e5] bg-white p-4">
              <p className="text-sm font-semibold text-[#171717]">Reason</p>
              <p className="mt-1 text-xs text-[#737373]">Optional. Keep it short if no detail is needed.</p>
              <textarea
                value={reason}
                onChange={event => setReason(event.target.value)}
                rows={6}
                className="tbo-focus mt-3 w-full rounded-xl border border-[#d4d4d4] px-3 py-2 text-sm"
                placeholder="Reason for absence..."
              />
              <button
                type="button"
                onClick={() => void submitNotice()}
                disabled={saving || selectedClassIds.size === 0}
                className="tbo-focus mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#171717] px-3 text-sm font-semibold text-white hover:bg-[#262626] disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
                {saving ? 'Submitting...' : 'Submit notice'}
              </button>
            </section>
          </aside>
        </section>
      )}

      {scope === 'admin' && (
        <section className="space-y-3">
          <div className="grid gap-3 border-y border-[#d4d4d4] bg-white px-4 py-3 lg:grid-cols-[minmax(260px,1fr)_auto] lg:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-[#737373]" />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search student, reason, or session"
                className="tbo-focus h-10 w-full border-0 border-b border-[#d4d4d4] bg-transparent pl-7 pr-3 text-sm font-medium text-[#171717]"
              />
            </div>
            <select
              value={eventFilter}
              onChange={event => setEventFilter(event.target.value === 'all' ? 'all' : Number(event.target.value))}
              className="tbo-focus h-9 rounded-md border border-[#e5e5e5] bg-[#fafafa] px-2 text-sm font-semibold text-[#171717]"
            >
              <option value="all">All upcoming notices</option>
              {nextFiveEvents.map(event => (
                <option key={event.classId} value={event.classId}>
                  {formatPlatformDate(event.date)} - {event.title}
                </option>
              ))}
            </select>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-[#171717]">{scope === 'student' ? 'Your notices' : 'Submitted notices'}</p>
          <span className="rounded-full bg-[#fafafa] px-3 py-1 text-xs font-semibold text-[#737373] ring-1 ring-[#e5e5e5]">{filteredNotices.length}</span>
        </div>
        {loading ? (
          <p className="rounded-2xl border border-[#e5e5e5] bg-white p-6 text-sm text-[#737373]">Loading absence notices...</p>
        ) : filteredNotices.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[#d4d4d4] bg-white p-8 text-center text-sm text-[#737373]">No absence notices found.</p>
        ) : filteredNotices.map(notice => {
          const expanded = expandedIds.has(notice.id);
          const student = users.find(user => user.id === notice.student_id);
          const sessions = notice.sessions ?? [];
          return (
            <article key={notice.id} className="overflow-hidden rounded-2xl border border-[#e5e5e5] bg-white">
              <button
                type="button"
                onClick={() => toggleNotice(notice.id)}
                className="tbo-focus grid w-full gap-3 px-4 py-3 text-left md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center"
              >
                {scope === 'admin' ? (
                  student ? <UserAvatar user={student} size="sm" /> : <span className="h-8 w-8 rounded-full bg-[#f5f5f5]" />
                ) : (
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-[#fef7e0] text-[#b06000]"><ClipboardList className="h-4 w-4" /></span>
                )}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-[#171717]">{scope === 'admin' ? notice.student?.name ?? 'Unknown student' : `${sessions.length} session${sessions.length === 1 ? '' : 's'}`}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#737373]">
                    <span>Submitted {formatPlatformDate(notice.submitted_at)}</span>
                    {sessions[0]?.class?.date && <span>First session {formatPlatformDate(sessions[0].class.date)}</span>}
                    <span className="capitalize">{notice.status}</span>
                  </span>
                </span>
                <span className="flex items-center gap-2 md:justify-end">
                  <span className="rounded-full bg-[#fef7e0] px-2.5 py-1 text-xs font-semibold text-[#b06000] ring-1 ring-[#fce8b2]">{sessions.length} selected</span>
                  {expanded ? <ChevronDown className="h-4 w-4 text-[#737373]" /> : <ChevronRight className="h-4 w-4 text-[#737373]" />}
                </span>
              </button>
              {expanded && (
                <div className="border-t border-[#eeeeee] bg-[#fafafa] px-4 py-4">
                  {notice.reason && (
                    <div className="mb-3 rounded-xl border border-[#e5e5e5] bg-white px-3 py-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#737373]">Reason</p>
                      <p className="mt-1 text-sm text-[#525252]">{notice.reason}</p>
                    </div>
                  )}
                  <div className="grid gap-2">
                    {sessions.map(session => {
                      const course = getSessionCourse(session, courses);
                      const activation = session.class ? isActivationSession(session.class as Class) : false;
                      return (
                        <div key={session.id} className="grid gap-2 rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[#171717]">{session.class?.title ?? 'Session'}</p>
                            <p className="mt-1 text-xs text-[#737373]">
                              {formatPlatformDate(session.class?.date)} · {getHourLabel(session.class?.hour ?? 'first')} · {session.class?.subject?.title ?? 'Subject'}
                              {activation ? ' · Activation Saturday' : ''}
                            </p>
                          </div>
                          {course && <ActiveYearGroupBadge course={course} size="sm" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </section>
    </div>
  );
}
