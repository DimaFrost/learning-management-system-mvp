import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  GraduationCap,
  HeartHandshake,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react';
import type {
  BookReadingAssignment,
  BookReadingSubmission,
  Course,
  CourseStudent,
  HomeworkSubmission,
  MentorshipLog,
  MinistryRotation,
  MinistryTeam,
  StudentAttendanceSummary,
  User,
} from '../../types/lms';
import { supabase } from '../../lib/supabase';
import { formatPlatformDate } from '../../utils/dateUtils';
import { ActiveYearGroupBadge, UserAvatar } from './users/usersShared';

type HomeworkRow = HomeworkSubmission & {
  assignmentTitle: string;
  dueDate: string | null;
  classTitle: string;
};

type SessionRow = {
  id: string;
  date: string;
  title: string;
  hour: string;
  subjectTitle: string;
  course: Course;
  teacher?: User;
};

type SessionWeekGroup = {
  key: string;
  label: string;
  range: string;
  rows: SessionRow[];
};

type SessionDayGroup = {
  key: string;
  dayLabel: string;
  rows: SessionRow[];
};

interface AdminStudentDashboardProps {
  studentId: string | null;
  users: User[];
  courses: Course[];
  courseStudents: CourseStudent[];
  mentorshipLogs: MentorshipLog[];
  ministryTeams: MinistryTeam[];
  ministryRotations: MinistryRotation[];
  getUserById: (id: string | null) => User | undefined;
  getCourseSummaries: (courseId: number) => StudentAttendanceSummary[];
  bookAssignments: BookReadingAssignment[];
  bookSubmissions: BookReadingSubmission[];
  onBack: () => void;
  onEditUser: (user: User) => void;
  onNavigate: (view: string) => void;
}

function StatCard({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-2xl border border-[#e5e5e5] bg-white p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[#171717]">{value}</p>
      <p className="mt-1 text-sm text-[#737373]">{detail}</p>
    </div>
  );
}

function SectionCard({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  icon: typeof GraduationCap;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#e5e5e5] bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#f5f5f5] text-[#525252]">
            <Icon className="h-4 w-4" />
          </span>
          <h3 className="truncate font-semibold text-[#171717]">{title}</h3>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}

function SourceButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#e5e5e5] bg-white px-2.5 text-xs font-semibold text-[#525252] shadow-sm hover:border-[#d4d4d4] hover:bg-[#f5f5f5]"
    >
      {children}
      <ArrowUpRight className="h-3.5 w-3.5" />
    </button>
  );
}

function parseLocalDate(dateString: string): Date {
  return dateString.includes('T') ? new Date(dateString) : new Date(`${dateString}T00:00:00`);
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getWeekStart(dateString: string): Date {
  const date = parseLocalDate(dateString);
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = new Date(date);
  start.setDate(date.getDate() + mondayOffset);
  return start;
}

function TeacherIcon({ user }: { user?: User }) {
  return (
    <span title={user?.name ?? 'Teacher not assigned'} aria-label={user?.name ?? 'Teacher not assigned'}>
      {user ? (
        <UserAvatar user={user} size="sm" />
      ) : (
        <span className="grid h-8 w-8 place-items-center rounded-full bg-[#f5f5f5] text-[#a3a3a3] ring-1 ring-[#e5e5e5]">
          <UserIcon className="h-4 w-4" />
        </span>
      )}
    </span>
  );
}

function getSessionSlotLabel(hour: string): string {
  if (hour === 'first') return 'S1';
  if (hour === 'second') return 'S2';
  if (hour === 'both') return 'Joint';
  return hour;
}

function getSessionSlotTitle(hour: string): string {
  if (hour === 'first') return 'Session 1';
  if (hour === 'second') return 'Session 2';
  if (hour === 'both') return 'Joint session';
  return hour;
}

function getDayLabel(dateString: string): string {
  return parseLocalDate(dateString).toLocaleDateString('en-GB', { weekday: 'short' });
}

function groupSessionsByDay(rows: SessionRow[]): SessionDayGroup[] {
  const groups = new Map<string, SessionRow[]>();
  rows.forEach(row => {
    groups.set(row.date, [...(groups.get(row.date) ?? []), row]);
  });

  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, dayRows]) => ({
      key,
      dayLabel: getDayLabel(key),
      rows: dayRows.sort((a, b) => {
        const order: Record<string, number> = { first: 0, second: 1, both: 2 };
        return (order[a.hour] ?? 3) - (order[b.hour] ?? 3) || a.title.localeCompare(b.title);
      }),
    }));
}

export function AdminStudentDashboard({
  studentId,
  users,
  courses,
  courseStudents,
  mentorshipLogs,
  ministryTeams,
  ministryRotations,
  getUserById,
  getCourseSummaries,
  bookAssignments,
  bookSubmissions,
  onBack,
  onEditUser,
  onNavigate,
}: AdminStudentDashboardProps) {
  const [homeworkRows, setHomeworkRows] = useState<HomeworkRow[]>([]);
  const [homeworkLoading, setHomeworkLoading] = useState(false);
  const [sessionWeekPage, setSessionWeekPage] = useState(0);
  const student = users.find(user => user.id === studentId);

  const activeEnrollments = useMemo(() => {
    if (!student) return [];
    return courseStudents
      .filter(enrollment => enrollment.studentId === student.id && enrollment.status === 'active')
      .sort((a, b) => b.enrollmentDate.localeCompare(a.enrollmentDate))
      .slice(0, 1)
      .map(enrollment => ({
        enrollment,
        course: courses.find(course => course.id === enrollment.courseId),
        mentor: getUserById(enrollment.mentorId),
      }))
      .filter((item): item is { enrollment: CourseStudent; course: Course; mentor: User | undefined } => !!item.course);
  }, [courseStudents, courses, getUserById, student]);

  const primaryCourse = activeEnrollments[0]?.course;
  const attendanceSummary = primaryCourse
    ? getCourseSummaries(primaryCourse.id).find(summary => summary.studentId === student?.id) ?? null
    : null;

  const studentLogs = student
    ? mentorshipLogs
        .filter(log => log.studentId === student.id)
        .sort((a, b) => b.date.localeCompare(a.date))
    : [];
  const menteeRows = student
    ? courseStudents
        .filter(enrollment => enrollment.mentorId === student.id && enrollment.status === 'active')
        .map(enrollment => getUserById(enrollment.studentId))
        .filter((user): user is User => !!user)
    : [];
  const activeRotation = student
    ? ministryRotations
        .filter(rotation => rotation.studentId === student.id && rotation.status === 'active')
        .sort((a, b) => b.startDate.localeCompare(a.startDate))[0]
    : undefined;
  const activeTeam = activeRotation
    ? ministryTeams.find(team => team.id === activeRotation.teamId)
    : undefined;
  const activeCourseIds = activeEnrollments.map(({ course }) => course.id);
  const studentBookSubmissions = student
    ? bookSubmissions.filter(submission => submission.studentId === student.id)
    : [];
  const bookSubmissionByAssignment = new Map<number, BookReadingSubmission>();
  studentBookSubmissions.forEach(submission => bookSubmissionByAssignment.set(submission.assignmentId, submission));
  const studentBookAssignments = bookAssignments
    .filter(assignment => assignment.status !== 'archived' && activeCourseIds.includes(assignment.courseId))
    .sort((a, b) => (a.dueDate ?? '9999-12-31').localeCompare(b.dueDate ?? '9999-12-31'));
  const completedBooks = studentBookAssignments.filter(assignment => {
    const status = bookSubmissionByAssignment.get(assignment.id)?.status;
    return status === 'submitted' || status === 'completed';
  }).length;
  const overdueBooks = studentBookAssignments.filter(assignment => {
    const status = bookSubmissionByAssignment.get(assignment.id)?.status ?? 'not_started';
    return assignment.dueDate && assignment.dueDate < toDateKey(new Date()) && status !== 'submitted' && status !== 'completed';
  }).length;

  const sessionWeeks = useMemo<SessionWeekGroup[]>(() => {
    const rows = activeEnrollments
      .flatMap(({ course }) =>
        course.subjects
          .filter(subject => subject.courseId == null || subject.courseId === course.id)
          .flatMap(subject => subject.classes.map(cls => ({
            id: `${course.id}-${subject.id}-${cls.id}`,
            date: cls.date,
            title: cls.title,
            hour: cls.hour,
            subjectTitle: subject.title,
            course,
            teacher: getUserById(cls.teacherId),
          })))
      )
      .sort((a, b) => a.date.localeCompare(b.date));

    const groups = new Map<string, SessionRow[]>();
    rows.forEach(row => {
      const key = toDateKey(getWeekStart(row.date));
      groups.set(key, [...(groups.get(key) ?? []), row]);
    });

    return Array.from(groups.entries()).map(([key, weekRows], index) => {
      const start = parseLocalDate(key);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return {
        key,
        label: `Week ${index + 1}`,
        range: `${formatPlatformDate(toDateKey(start))} - ${formatPlatformDate(toDateKey(end))}`,
        rows: weekRows,
      };
    });
  }, [activeEnrollments, getUserById]);

  const visibleSessionWeeks = sessionWeeks[sessionWeekPage] ? [sessionWeeks[sessionWeekPage]] : [];
  const maxSessionWeekPage = Math.max(0, sessionWeeks.length - 1);

  useEffect(() => {
    if (!student) {
      setHomeworkRows([]);
      return;
    }

    let cancelled = false;
    const fetchHomework = async () => {
      setHomeworkLoading(true);
      const { data, error } = await supabase
        .from('homework_submissions')
        .select(`
          id, assignment_id, student_id, submission_type, drive_file_id, drive_view_url,
          file_name, google_doc_id, google_doc_url, status, submitted_at, points,
          grade_comment, graded_at, graded_by, created_at, updated_at,
          assignment:homework_assignments(
            title, due_date,
            class:classes(title)
          )
        `)
        .eq('student_id', student.id)
        .order('updated_at', { ascending: false });

      if (!cancelled) {
        if (error) {
          console.error('Failed to load student homework', error);
          setHomeworkRows([]);
        } else {
          setHomeworkRows((data ?? []).map(row => ({
            id: row.id,
            assignmentId: row.assignment_id,
            studentId: row.student_id,
            studentName: student.name,
            submissionType: row.submission_type,
            driveFileId: row.drive_file_id,
            driveViewUrl: row.drive_view_url,
            fileName: row.file_name,
            googleDocId: row.google_doc_id,
            googleDocUrl: row.google_doc_url,
            status: row.status,
            submittedAt: row.submitted_at,
            points: row.points,
            gradeComment: row.grade_comment,
            gradedAt: row.graded_at,
            gradedBy: row.graded_by,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            assignmentTitle: row.assignment?.title ?? 'Homework',
            dueDate: row.assignment?.due_date ?? null,
            classTitle: row.assignment?.class?.title ?? 'Class session',
          })));
        }
        setHomeworkLoading(false);
      }
    };

    void fetchHomework();
    return () => {
      cancelled = true;
    };
  }, [student]);

  if (!student) {
    return (
      <div className="rounded-2xl border border-dashed border-[#d4d4d4] bg-white p-8 text-center">
        <p className="font-semibold text-[#171717]">No student selected.</p>
        <button type="button" onClick={onBack} className="mt-4 rounded-lg bg-[#171717] px-4 py-2 text-sm font-semibold text-white">
          Back to users
        </button>
      </div>
    );
  }

  const passingGates = attendanceSummary?.gates.filter(gate => gate.status === 'passing').length ?? 0;
  const gateCount = attendanceSummary?.gates.length ?? 0;
  const submittedHomework = homeworkRows.filter(row => row.status === 'submitted' || row.status === 'graded').length;
  const gradedHomework = homeworkRows.filter(row => row.status === 'graded').length;

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-[#e5e5e5] bg-white p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <UserAvatar user={student} />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#737373]">Student dashboard</p>
              <h2 className="mt-1 truncate text-2xl font-semibold text-[#171717]">{student.name}</h2>
              <p className="truncate text-sm text-[#737373]">{student.email}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {activeEnrollments.map(({ course }) => <ActiveYearGroupBadge key={course.id} course={course} />)}
                {activeEnrollments.length === 0 && <span className="text-sm text-[#737373]">No active year group</span>}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => onEditUser(student)} className="rounded-lg border border-[#dbeafe] bg-[#eff6ff] px-4 py-2 text-sm font-semibold text-[#1d4ed8]">
              Edit student
            </button>
            <button type="button" onClick={onBack} className="rounded-lg border border-[#e5e5e5] px-4 py-2 text-sm font-semibold text-[#525252] hover:bg-[#f5f5f5]">
              Back
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Attendance gates" value={gateCount ? `${passingGates}/${gateCount}` : '-'} detail={attendanceSummary?.meetsGraduationThreshold ? 'On track' : 'Needs review'} />
        <StatCard label="Homework" value={`${submittedHomework}/${homeworkRows.length}`} detail={`${gradedHomework} graded`} />
        <StatCard label="Books" value={`${completedBooks}/${studentBookAssignments.length}`} detail={overdueBooks > 0 ? `${overdueBooks} overdue` : 'Reading progress'} />
        <StatCard label="Mentor" value={activeEnrollments.some(item => item.mentor) ? 'Assigned' : 'Missing'} detail={activeEnrollments.map(item => item.mentor?.name).filter(Boolean).join(', ') || 'No mentor'} />
        <StatCard label="Ministry team" value={activeTeam?.name ?? '-'} detail={activeRotation ? `${formatPlatformDate(activeRotation.startDate)} - ${formatPlatformDate(activeRotation.endDate)}` : 'No active rotation'} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard
          title="Attendance"
          icon={CheckCircle2}
          action={<SourceButton onClick={() => onNavigate('attendance')}>Open attendance</SourceButton>}
        >
          {attendanceSummary ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {attendanceSummary.gates.map(gate => (
                <div key={gate.key} className="rounded-xl border border-[#e5e5e5] bg-[#fafafa] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-[#171717]">{gate.label}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${gate.status === 'passing' ? 'bg-[#dcfce7] text-[#15803d]' : gate.status === 'at_risk' ? 'bg-[#fff7ed] text-[#ea580c]' : 'bg-[#fee2e2] text-[#b91c1c]'}`}>
                      {gate.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[#525252]">{gate.detail}</p>
                  <p className="mt-1 text-xs text-[#737373]">{gate.earnedCredits}/{gate.requiredCredits} credits</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[#737373]">No attendance summary is available for this student yet.</p>
          )}
        </SectionCard>

        <SectionCard
          title="Year, mentor, ministry"
          icon={GraduationCap}
        >
          <div className="space-y-3">
            {activeEnrollments.map(({ course, enrollment, mentor }) => (
              <div key={course.id} className="rounded-xl border border-[#e5e5e5] bg-[#fafafa] p-3">
                <ActiveYearGroupBadge course={course} />
                <p className="mt-2 text-sm text-[#525252]">Enrolled {formatPlatformDate(enrollment.enrollmentDate)}</p>
                <p className="text-sm text-[#525252]">Mentor: {mentor?.name ?? 'Not assigned'}</p>
              </div>
            ))}
            <div className="rounded-xl border border-[#e5e5e5] p-3">
              <p className="text-sm font-semibold text-[#171717]">Ministry</p>
              <p className="mt-1 text-sm text-[#525252]">{activeTeam?.name ?? 'No active team rotation'}</p>
            </div>
            <div className="flex flex-wrap gap-1.5 border-t border-[#e5e5e5] pt-3">
              <SourceButton onClick={() => onNavigate('users-enrollments')}>Enrollment</SourceButton>
              <SourceButton onClick={() => onNavigate('mentorship-assignments')}>Mentor</SourceButton>
              <SourceButton onClick={() => onNavigate('attendance-ministry')}>Ministry</SourceButton>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard
          title="Homework submitted"
          icon={ClipboardCheck}
          action={<SourceButton onClick={() => onNavigate('curriculum')}>Open curriculum</SourceButton>}
        >
          {homeworkLoading ? (
            <p className="text-sm text-[#737373]">Loading homework...</p>
          ) : homeworkRows.length > 0 ? (
            <div className="space-y-2">
              {homeworkRows.slice(0, 8).map(row => (
                <div key={row.id} className="rounded-xl border border-[#e5e5e5] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#171717]">{row.assignmentTitle}</p>
                      <p className="truncate text-xs text-[#737373]">{row.classTitle}</p>
                    </div>
                    <span className="rounded-full bg-[#f5f5f5] px-2 py-0.5 text-xs font-semibold text-[#525252]">{row.status}</span>
                  </div>
                  <p className="mt-2 text-xs text-[#737373]">
                    {row.submittedAt ? `Submitted ${formatPlatformDate(row.submittedAt)}` : 'Not submitted'}{row.points !== null ? ` · ${row.points} points` : ''}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[#737373]">No homework submissions found yet.</p>
          )}
        </SectionCard>

        <SectionCard
          title="Books and reading"
          icon={BookOpen}
          action={<SourceButton onClick={() => onNavigate('curriculum-books')}>Open books</SourceButton>}
        >
          {studentBookAssignments.length > 0 ? (
            <div className="space-y-2">
              {studentBookAssignments.slice(0, 8).map(assignment => {
                const submission = bookSubmissionByAssignment.get(assignment.id);
                const status = submission?.status ?? 'not_started';
                return (
                  <div key={assignment.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-[#e5e5e5] p-2.5">
                    <div className="grid h-14 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-[#f5f5f5] text-[#a3a3a3]">
                      {assignment.book.coverUrl ? (
                        <img src={assignment.book.coverUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <BookOpen className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#171717]">{assignment.book.title}</p>
                      <p className="truncate text-xs text-[#737373]">{assignment.title}</p>
                      <p className={`mt-1 text-xs ${assignment.dueDate && assignment.dueDate < toDateKey(new Date()) && status !== 'submitted' && status !== 'completed' ? 'text-[#c2410c]' : 'text-[#737373]'}`}>
                        {assignment.dueDate ? `Due ${formatPlatformDate(assignment.dueDate)}` : 'No due date'}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-[#f5f5f5] px-2 py-0.5 text-xs font-semibold capitalize text-[#525252]">
                      {status.replace('_', ' ')}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-[#737373]">No reading assignments are attached to this student's active year group yet.</p>
          )}
        </SectionCard>

        <SectionCard
          title="Mentorship"
          icon={HeartHandshake}
          action={<SourceButton onClick={() => onNavigate('mentorship')}>Open mentorship</SourceButton>}
        >
          <div className="space-y-3">
            <div className="rounded-xl border border-[#e5e5e5] p-3">
              <p className="text-sm font-semibold text-[#171717]">Mentees</p>
              <p className="mt-1 text-sm text-[#525252]">{menteeRows.length > 0 ? menteeRows.map(user => user.name).join(', ') : 'No mentees assigned.'}</p>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-[#171717]">Recent logs</p>
              {studentLogs.slice(0, 5).map(log => (
                <div key={log.id} className="mb-2 rounded-xl border border-[#e5e5e5] bg-[#fafafa] p-3">
                  <p className="text-sm font-semibold text-[#171717]">{formatPlatformDate(log.date)} · {log.type}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-[#525252]">{log.notes || 'No notes added.'}</p>
                </div>
              ))}
              {studentLogs.length === 0 && <p className="text-sm text-[#737373]">No mentorship logs yet.</p>}
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard
          title="Classes and sessions"
          icon={BookOpen}
          action={<SourceButton onClick={() => onNavigate('curriculum')}>Open planning</SourceButton>}
        >
          {sessionWeeks.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-[#e5e5e5] bg-[#fafafa] px-3 py-2">
                <p className="text-xs font-semibold text-[#525252]">
                  {sessionWeeks.length} weeks · {sessionWeeks.reduce((total, week) => total + week.rows.length, 0)} sessions
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Previous session weeks"
                    disabled={sessionWeekPage === 0}
                    onClick={() => setSessionWeekPage(page => Math.max(0, page - 1))}
                    className="grid h-7 w-7 place-items-center rounded-lg border border-[#e5e5e5] bg-white text-[#525252] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="min-w-12 text-center text-xs font-semibold text-[#737373]">
                    {sessionWeekPage + 1}/{maxSessionWeekPage + 1}
                  </span>
                  <button
                    type="button"
                    aria-label="Next session weeks"
                    disabled={sessionWeekPage >= maxSessionWeekPage}
                    onClick={() => setSessionWeekPage(page => Math.min(maxSessionWeekPage, page + 1))}
                    className="grid h-7 w-7 place-items-center rounded-lg border border-[#e5e5e5] bg-white text-[#525252] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {visibleSessionWeeks.map(week => (
                <div key={week.key} className="overflow-hidden rounded-2xl border border-[#e5e5e5]">
                  <div className="flex items-center justify-between gap-3 border-b border-[#e5e5e5] bg-[#f5f5f5] px-3 py-2">
                    <p className="text-sm font-semibold text-[#171717]">{week.label}</p>
                    <p className="text-xs font-medium text-[#737373]">{week.range}</p>
                  </div>
                  <div className="divide-y divide-[#eeeeee]">
                    {groupSessionsByDay(week.rows).map(day => (
                      <div key={day.key} className="grid gap-3 px-3 py-2.5 md:grid-cols-[44px_minmax(0,1fr)] md:items-stretch">
                        <div className="flex items-center justify-start md:justify-center">
                          <span className="rounded-lg bg-[#f5f5f5] px-2 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#737373]">
                            {day.dayLabel}
                          </span>
                        </div>
                        <div className="grid gap-2 md:grid-cols-2">
                          {day.rows.map(row => (
                            <div
                              key={row.id}
                              className={`flex min-w-0 items-center justify-between gap-3 rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 ${row.hour === 'both' ? 'md:col-span-2' : ''}`}
                            >
                              <div className="min-w-0">
                                <div className="flex min-w-0 items-center gap-2">
                                  <span title={getSessionSlotTitle(row.hour)} className="shrink-0 rounded-full bg-[#f5f5f5] px-2 py-0.5 text-[11px] font-semibold text-[#525252]">
                                    {getSessionSlotLabel(row.hour)}
                                  </span>
                                  <p className="truncate text-sm font-semibold text-[#171717]">{row.title}</p>
                                </div>
                                <p className="mt-1 truncate text-xs text-[#737373]">{row.subjectTitle}</p>
                              </div>
                              <TeacherIcon user={row.teacher} />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[#737373]">No classes or sessions found for this student yet.</p>
          )}
        </SectionCard>

        <SectionCard
          title="Duty and service"
          icon={ShieldCheck}
          action={(
            <div className="flex flex-wrap justify-end gap-1.5">
              <SourceButton onClick={() => onNavigate('attendance-duty')}>On duty</SourceButton>
              <SourceButton onClick={() => onNavigate('attendance-ministry')}>Service</SourceButton>
            </div>
          )}
        >
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-[#e5e5e5] bg-[#fafafa] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">Ministry</p>
                    <p className="mt-1 text-base font-semibold text-[#171717]">{activeTeam?.name ?? 'Not assigned'}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${activeRotation ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-[#fee2e2] text-[#b91c1c]'}`}>
                    {activeRotation ? 'Active' : 'Missing'}
                  </span>
                </div>
                <p className="mt-3 text-xs text-[#737373]">
                  {activeRotation
                    ? `${formatPlatformDate(activeRotation.startDate)} - ${formatPlatformDate(activeRotation.endDate)}`
                    : 'No ministry rotation is currently attached to this student.'}
                </p>
              </div>

              <div className="rounded-2xl border border-[#e5e5e5] bg-[#fafafa] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">Attendance duty</p>
                    <p className="mt-1 text-base font-semibold text-[#171717]">On-duty schedule</p>
                  </div>
                  <span className="rounded-full bg-[#eff6ff] px-2 py-0.5 text-xs font-semibold text-[#1d4ed8]">Tracked</span>
                </div>
                <p className="mt-3 text-xs text-[#737373]">
                  Class and Well keeper assignments are managed from the on-duty schedule.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-[#e5e5e5] bg-white p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">Access on platform</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {student.roles.filter(role => role !== 'dev').length > 0 ? (
                  student.roles.filter(role => role !== 'dev').map(role => (
                    <span key={role} className="rounded-full border border-[#e5e5e5] bg-[#fafafa] px-2 py-1 text-xs font-semibold capitalize text-[#525252]">
                      {role.replace('_', ' ')}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-[#737373]">No platform roles</span>
                )}
              </div>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
