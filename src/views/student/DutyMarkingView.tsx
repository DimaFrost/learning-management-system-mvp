import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  CheckCircle,
  Calendar,
  ArrowLeftRight,
  X,
  Clock3,
  Users,
  AlertCircle,
  Circle,
  Save,
} from 'lucide-react';
import type {
  User,
  Course,
  CourseStudent,
  Class,
  AttendanceStatus,
  ClassAttendanceRecord,
  TheWellSessionRecord,
  DutyScheduleEntry,
  Subject,
  WellScheduleEntry,
} from '../../types/lms';
import { getCourseDisplayName, getClassDisplayTitle, isCourseActive } from '../../utils/courseUtils';
import { sortByFirstName, getWellDateForWeek, isActivationSaturdayClass } from '../../utils/attendanceUtils';
import { formatPlatformDate } from '../../utils/dateUtils';

interface DutyMarkingViewProps {
  currentUser: User;
  currentDuties: DutyScheduleEntry[];
  courses: Course[];
  courseStudents: CourseStudent[];
  users: User[];
  classAttendance: ClassAttendanceRecord[];
  theWellSessionAttendance: TheWellSessionRecord[];
  wellSchedule: WellScheduleEntry[];
  onMarkClassAttendance: (
    classId: number,
    records: Array<{ studentId: string; status: AttendanceStatus }>
  ) => Promise<void>;
  onMarkWellSessionAttendance: (
    weekStart: string,
    courseId: number,
    records: Array<{ studentId: string; status: AttendanceStatus }>
  ) => Promise<void>;
  onRequestTransfer: (params: {
    dutyScheduleId: number;
    toStudentId: string;
    reason?: string;
  }) => Promise<void>;
  loading?: boolean;
}

type ClassTimelineItem = { type: 'class'; cls: Class; subject: Subject };
type WellTimelineItem = { type: 'well'; date: string };
type TimelineItem = ClassTimelineItem | WellTimelineItem;
type TimelineKey = string;

const HOUR_ORDER: Record<Class['hour'], number> = { first: 0, second: 1, both: 2 };

function formatWeekDate(dateStr: string): string {
  return formatPlatformDate(dateStr);
}

function formatClassDate(dateStr: string): string {
  return formatPlatformDate(dateStr);
}

function formatSessionType(cls: Class): string {
  if (isActivationSaturdayClass(cls)) return 'Activation Saturday';
  switch (cls.hour) {
    case 'first':
      return 'First Hour';
    case 'second':
      return 'Second Hour';
    case 'both':
      return 'Joint Session';
  }
}

function getInitials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || '?';
}

function getTimelineKey(item: TimelineItem): TimelineKey {
  return item.type === 'class' ? `class-${item.cls.id}` : 'well';
}

function getTimelineTitle(item: TimelineItem, currentUser: User): string {
  return item.type === 'class'
    ? getClassDisplayTitle(item.cls, item.subject, currentUser.roles)
    : 'The Well';
}

function getTimelineDate(item: TimelineItem): string {
  return item.type === 'class' ? item.cls.date : item.date;
}

function getStatusTone(status: AttendanceStatus): string {
  if (status === 'present') return 'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]';
  if (status === 'late') return 'border-[#fed7aa] bg-[#fff7ed] text-[#c2410c]';
  return 'border-[#e5e5e5] bg-[#f5f5f5] text-[#525252]';
}

function getStatusIcon(status: AttendanceStatus) {
  if (status === 'present') return CheckCircle;
  if (status === 'late') return Clock3;
  return Circle;
}

function countDraftStatuses(
  draft: Record<string, AttendanceStatus>,
  students: User[]
): Record<AttendanceStatus, number> {
  return students.reduce<Record<AttendanceStatus, number>>((counts, student) => {
    const status = draft[student.id] ?? 'absent';
    counts[status] += 1;
    return counts;
  }, { present: 0, late: 0, absent: 0 });
}

function getDayOfWeek(dateStr: string): number {
  return new Date(dateStr + 'T00:00:00').getDay();
}

function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildClassDrafts(
  classes: Class[],
  students: User[],
  records: ClassAttendanceRecord[]
): Record<number, Record<string, AttendanceStatus>> {
  const drafts: Record<number, Record<string, AttendanceStatus>> = {};
  for (const cls of classes) {
    const classRecords = records.filter(r => r.classId === cls.id);
    drafts[cls.id] = {};
    for (const student of students) {
      const existing = classRecords.find(r => r.studentId === student.id);
      drafts[cls.id][student.id] = existing?.status ?? 'absent';
    }
  }
  return drafts;
}

function buildWellDrafts(
  students: User[],
  records: TheWellSessionRecord[],
  courseId: number,
  weekStart: string
): Record<string, AttendanceStatus> {
  const drafts: Record<string, AttendanceStatus> = {};
  for (const student of students) {
    const existing = records.find(
      r => r.studentId === student.id
        && r.courseId === courseId
        && r.weekStart === weekStart
    );
    drafts[student.id] = existing?.status ?? 'absent';
  }
  return drafts;
}

function classHasSavedAttendance(
  classId: number,
  students: User[],
  records: ClassAttendanceRecord[],
  savedClassIds: Set<number>
): boolean {
  if (savedClassIds.has(classId)) return true;
  return students.every(s => records.some(r => r.classId === classId && r.studentId === s.id));
}

function wellHasSavedAttendance(
  weekStart: string,
  courseId: number,
  students: User[],
  records: TheWellSessionRecord[],
  wellSaved: boolean
): boolean {
  if (wellSaved) return true;
  return students.every(s =>
    records.some(
      r => r.studentId === s.id && r.courseId === courseId && r.weekStart === weekStart
    )
  );
}

function buildDutyTimeline(
  classesThisWeek: ClassTimelineItem[],
  weekStart: string,
  showWell: boolean
): TimelineItem[] {
  const items: TimelineItem[] = [...classesThisWeek];
  if (showWell) {
    items.push({ type: 'well', date: getWellDateForWeek(weekStart) });
  }

  return items.sort((a, b) => {
    const dateA = a.type === 'well' ? a.date : a.cls.date;
    const dateB = b.type === 'well' ? b.date : b.cls.date;
    const dateCmp = dateA.localeCompare(dateB);
    if (dateCmp !== 0) return dateCmp;
    if (a.type === 'well') return -1;
    if (b.type === 'well') return 1;
    return HOUR_ORDER[a.cls.hour] - HOUR_ORDER[b.cls.hour];
  });
}

export function DutyMarkingView({
  currentUser,
  currentDuties,
  courses,
  courseStudents,
  users,
  classAttendance,
  theWellSessionAttendance,
  wellSchedule,
  onMarkClassAttendance,
  onMarkWellSessionAttendance,
  onRequestTransfer,
  loading,
}: DutyMarkingViewProps) {
  const [transferOpen, setTransferOpen] = useState(false);
  const [toStudentId, setToStudentId] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [submittingTransfer, setSubmittingTransfer] = useState(false);
  const [classDrafts, setClassDrafts] = useState<Record<number, Record<string, AttendanceStatus>>>({});
  const [savingClassId, setSavingClassId] = useState<number | null>(null);
  const [savedClassIds, setSavedClassIds] = useState<Set<number>>(new Set());
  const [wellDrafts, setWellDrafts] = useState<Record<string, AttendanceStatus>>({});
  const [savingWell, setSavingWell] = useState(false);
  const [wellSaved, setWellSaved] = useState(false);
  const [selectedDutyId, setSelectedDutyId] = useState(currentDuties[0]?.id ?? 0);
  const [selectedTimelineKey, setSelectedTimelineKey] = useState<TimelineKey>('');

  useEffect(() => {
    if (currentDuties.length === 0) return;
    if (!currentDuties.some(duty => duty.id === selectedDutyId)) {
      setSelectedDutyId(currentDuties[0].id);
    }
  }, [currentDuties, selectedDutyId]);

  const selectedDuty = currentDuties.find(duty => duty.id === selectedDutyId) ?? currentDuties[0];
  const dutyCourse = selectedDuty
    ? courses.find(c => c.id === selectedDuty.courseId)
    : undefined;

  const dutyYearCourseIds = useMemo(() => {
    if (!selectedDuty || !dutyCourse) return new Set<number>();
    const ids = new Set<number>([selectedDuty.courseId]);

    for (const course of courses) {
      if (course.courseType === dutyCourse.courseType && isCourseActive(course)) {
        ids.add(course.id);
      }
    }

    return ids;
  }, [courses, dutyCourse, selectedDuty]);

  const enrolledStudents = useMemo(() => {
    if (!selectedDuty || !dutyCourse) return [];
    const enrolledIds = new Set(
      courseStudents
        .filter(enrollment =>
          dutyYearCourseIds.has(enrollment.courseId) &&
          enrollment.status !== 'archived' &&
          enrollment.status !== 'withdrawn'
        )
        .map(enrollment => enrollment.studentId)
    );
    const enrolledUsers = users.filter(user =>
      enrolledIds.has(user.id) &&
      user.roles.includes('student')
    );
    return sortByFirstName(enrolledUsers);
  }, [courseStudents, dutyCourse, dutyYearCourseIds, selectedDuty, users]);

  const transferCandidates = useMemo(
    () => enrolledStudents.filter(s => s.id !== currentUser.id),
    [enrolledStudents, currentUser.id]
  );

  const classesThisWeek = useMemo(() => {
    if (!dutyCourse || !selectedDuty) return [];
    const { weekStart, weekEnd } = selectedDuty;
    return dutyCourse.subjects
      .flatMap((subject: Subject) =>
        subject.classes
          .filter(cls => cls.date && cls.date >= weekStart && cls.date <= weekEnd)
          .map(cls => ({ type: 'class' as const, cls, subject }))
      )
      .sort((a, b) => {
        const dateCmp = a.cls.date.localeCompare(b.cls.date);
        if (dateCmp !== 0) return dateCmp;
        return HOUR_ORDER[a.cls.hour] - HOUR_ORDER[b.cls.hour];
      });
  }, [dutyCourse, selectedDuty]);

  const todayDate = getLocalDateString();
  const classesToday = useMemo(
    () => classesThisWeek.filter(item => item.cls.date === todayDate),
    [classesThisWeek, todayDate]
  );

  const showWell = useMemo(() => {
    if (!selectedDuty || !dutyCourse) return false;
    const wellDate = getWellDateForWeek(selectedDuty.weekStart);
    if (wellDate !== todayDate) return false;
    const courseWellEntries = wellSchedule.filter(entry => entry.courseId === dutyCourse.id);
    if (courseWellEntries.length > 0) {
      return courseWellEntries.some(entry => entry.weekStart === selectedDuty.weekStart);
    }
    return classesThisWeek.some(c => getDayOfWeek(c.cls.date) === 2)
      && classesThisWeek.some(c => getDayOfWeek(c.cls.date) === 4);
  }, [classesThisWeek, dutyCourse, selectedDuty, todayDate, wellSchedule]);

  const dutyTimeline = useMemo(
    () => selectedDuty
      ? buildDutyTimeline(classesToday, selectedDuty.weekStart, showWell)
      : [],
    [classesToday, selectedDuty, showWell]
  );

  useEffect(() => {
    if (dutyTimeline.length === 0) {
      setSelectedTimelineKey('');
      return;
    }
    if (!dutyTimeline.some(item => getTimelineKey(item) === selectedTimelineKey)) {
      setSelectedTimelineKey(getTimelineKey(dutyTimeline[0]));
    }
  }, [dutyTimeline, selectedTimelineKey]);

  const selectedTimelineItem = dutyTimeline.find(item => getTimelineKey(item) === selectedTimelineKey) ?? dutyTimeline[0];

  useEffect(() => {
    setClassDrafts(
      buildClassDrafts(classesToday.map(({ cls }) => cls), enrolledStudents, classAttendance)
    );
  }, [classesToday, enrolledStudents, classAttendance]);

  useEffect(() => {
    if (!dutyCourse || !selectedDuty) return;
    setWellDrafts(
      buildWellDrafts(
        enrolledStudents,
        theWellSessionAttendance,
        dutyCourse.id,
        selectedDuty.weekStart
      )
    );
    setWellSaved(false);
  }, [enrolledStudents, theWellSessionAttendance, dutyCourse, selectedDuty]);

  const handleClassStatusChange = useCallback(
    (classId: number, studentId: string, status: AttendanceStatus) => {
      setClassDrafts(prev => ({
        ...prev,
        [classId]: { ...prev[classId], [studentId]: status },
      }));
      setSavedClassIds(prev => {
        const next = new Set(prev);
        next.delete(classId);
        return next;
      });
      setSavingClassId(classId);
      void onMarkClassAttendance(classId, [{ studentId, status }])
        .catch(error => {
          console.error('Failed to save class attendance status', error);
        })
        .finally(() => {
          setSavingClassId(current => current === classId ? null : current);
        });
    },
    [onMarkClassAttendance]
  );

  const handleWellStatusChange = useCallback(
    (studentId: string, status: AttendanceStatus) => {
      setWellDrafts(prev => ({ ...prev, [studentId]: status }));
      setWellSaved(false);
      if (!dutyCourse || !selectedDuty) return;
      setSavingWell(true);
      void onMarkWellSessionAttendance(selectedDuty.weekStart, dutyCourse.id, [{ studentId, status }])
        .catch(error => {
          console.error('Failed to save The Well attendance status', error);
        })
        .finally(() => setSavingWell(false));
    },
    [dutyCourse, onMarkWellSessionAttendance, selectedDuty]
  );

  const markAllClass = (classId: number, status: AttendanceStatus) => {
    setClassDrafts(prev => ({
      ...prev,
      [classId]: Object.fromEntries(enrolledStudents.map(student => [student.id, status])),
    }));
    setSavedClassIds(prev => {
      const next = new Set(prev);
      next.delete(classId);
      return next;
    });
  };

  const markAllWell = (status: AttendanceStatus) => {
    setWellDrafts(Object.fromEntries(enrolledStudents.map(student => [student.id, status])));
    setWellSaved(false);
  };

  const handleSaveClass = async (classId: number) => {
    const draft = classDrafts[classId];
    if (!draft) return;
    setSavingClassId(classId);
    try {
      const records = enrolledStudents.map(s => ({
        studentId: s.id,
        status: draft[s.id] ?? 'absent',
      }));
      await onMarkClassAttendance(classId, records);
      setSavedClassIds(prev => new Set(prev).add(classId));
    } finally {
      setSavingClassId(null);
    }
  };

  const handleSaveWell = async () => {
    if (!dutyCourse || !selectedDuty) return;
    setSavingWell(true);
    try {
      const records = enrolledStudents.map(s => ({
        studentId: s.id,
        status: wellDrafts[s.id] ?? 'absent',
      }));
      await onMarkWellSessionAttendance(
        selectedDuty.weekStart,
        dutyCourse.id,
        records
      );
      setWellSaved(true);
    } finally {
      setSavingWell(false);
    }
  };

  const handleSendTransfer = async () => {
    if (!toStudentId || !selectedDuty) return;
    setSubmittingTransfer(true);
    try {
      await onRequestTransfer({
        dutyScheduleId: selectedDuty.id,
        toStudentId,
        reason: transferReason.trim() || undefined,
      });
      setTransferOpen(false);
      setToStudentId('');
      setTransferReason('');
    } finally {
      setSubmittingTransfer(false);
    }
  };

  const closeTransferModal = () => {
    setTransferOpen(false);
    setToStudentId('');
    setTransferReason('');
  };

  const renderAttendanceTable = (
    draft: Record<string, AttendanceStatus>,
    onStatusChange: (studentId: string, status: AttendanceStatus) => void,
    namePrefix: string
  ) => {
    const counts = countDraftStatuses(draft, enrolledStudents);
    const statusOrder: Record<AttendanceStatus, number> = { absent: 0, late: 1, present: 2 };
    const orderedStudents = [...enrolledStudents].sort((a, b) => {
      const statusA = draft[a.id] ?? 'absent';
      const statusB = draft[b.id] ?? 'absent';
      const statusCompare = statusOrder[statusA] - statusOrder[statusB];
      if (statusCompare !== 0) return statusCompare;
      return a.name.localeCompare(b.name, ['bg', 'en'], { sensitivity: 'base' });
    });
    return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="pb-2 pr-4 font-medium">Student</th>
            <th className="pb-2 px-2 font-medium text-center">Present</th>
            <th className="pb-2 px-2 font-medium text-center">Late</th>
            <th className="pb-2 px-2 font-medium text-center">Absent</th>
          </tr>
        </thead>
        <tbody>
          {enrolledStudents.map(student => (
            <tr key={student.id} className="border-b border-gray-100">
              <td className="py-2.5 pr-4 font-medium text-gray-900">
                {student.name}
              </td>
              {(['present', 'late', 'absent'] as AttendanceStatus[]).map(status => (
                <td key={status} className="py-2.5 px-2 text-center">
                  <input
                    type="radio"
                    name={`${namePrefix}-${student.id}`}
                    checked={(draft[student.id] ?? 'absent') === status}
                    onChange={() => onStatusChange(student.id, status)}
                    className="w-4 h-4 text-amber-600 focus:ring-amber-500"
                    aria-label={`${student.name} — ${status}`}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    );
  };

  const renderRosterCards = (
    draft: Record<string, AttendanceStatus>,
    onStatusChange: (studentId: string, status: AttendanceStatus) => void,
    onMarkAll: (status: AttendanceStatus) => void
  ) => {
    const counts = countDraftStatuses(draft, enrolledStudents);
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 rounded-xl border border-[#e5e5e5] bg-[#fafafa] p-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="grid grid-cols-3 gap-2 text-center">
            {(['present', 'late', 'absent'] as AttendanceStatus[]).map(status => {
              const Icon = getStatusIcon(status);
              return (
                <div key={status} className={`rounded-lg border px-3 py-2 ${getStatusTone(status)}`}>
                  <div className="flex items-center justify-center gap-1.5 text-xs font-semibold capitalize">
                    <Icon className="h-3.5 w-3.5" />
                    {status}
                  </div>
                  <p className="mt-1 text-lg font-semibold leading-none">{counts[status]}</p>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            {(['present', 'late', 'absent'] as AttendanceStatus[]).map(status => (
              <button
                key={status}
                type="button"
                onClick={() => onMarkAll(status)}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold capitalize transition hover:shadow-sm ${getStatusTone(status)}`}
              >
                Mark all {status}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-2">
          {orderedStudents.map(student => {
            const selectedStatus = draft[student.id] ?? 'absent';
            return (
              <div key={student.id} className="grid gap-3 rounded-xl border border-[#e5e5e5] bg-white p-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-[#f5f5f5] text-xs font-semibold text-[#525252] ring-1 ring-[#e5e5e5]">
                    {student.avatarUrl ? <img src={student.avatarUrl} alt="" className="h-full w-full object-cover" /> : getInitials(student.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[#171717]">{student.name}</p>
                    <p className="text-xs capitalize text-[#737373]">{selectedStatus}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1.5 sm:w-[288px]">
                  {(['present', 'late', 'absent'] as AttendanceStatus[]).map(status => {
                    const selected = selectedStatus === status;
                    const Icon = getStatusIcon(status);
                    return (
                      <button
                        key={status}
                        type="button"
                        onClick={() => onStatusChange(student.id, status)}
                        className={`inline-flex h-9 items-center justify-center gap-1 rounded-lg border px-2 text-xs font-semibold capitalize transition ${
                          selected ? getStatusTone(status) : 'border-[#e5e5e5] bg-white text-[#737373] hover:bg-[#f5f5f5]'
                        }`}
                        aria-pressed={selected}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {status[0].toUpperCase()}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {enrolledStudents.length === 0 && (
            <div className="rounded-xl border border-dashed border-[#d4d4d4] p-6 text-center text-sm text-[#737373]">
              No students are enrolled in this course.
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!selectedDuty || !dutyCourse) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Course not found for this duty assignment.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">On Duty This Week 🎓</h2>
        <p className="text-sm text-gray-500">Loading attendance data…</p>
      </div>
    );
  }

  if (selectedTimelineItem) {
    const classItem = selectedTimelineItem.type === 'class' ? selectedTimelineItem : null;
    const selectedDraft = classItem ? classDrafts[classItem.cls.id] ?? {} : wellDrafts;
    const selectedSaved = classItem
      ? classHasSavedAttendance(classItem.cls.id, enrolledStudents, classAttendance, savedClassIds)
      : wellHasSavedAttendance(selectedDuty.weekStart, dutyCourse.id, enrolledStudents, theWellSessionAttendance, wellSaved);
    const selectedSaving = classItem ? savingClassId === classItem.cls.id : savingWell;

    return (
      <div className="space-y-4">
        <section className="overflow-hidden rounded-2xl border border-[#e5e5e5] bg-white shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
          <div className="border-b border-[#e5e5e5] bg-[#fafafa] p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#737373]">Attendance keeper</p>
                <h2 className="mt-1 text-2xl font-semibold text-[#171717]">On Duty</h2>
                <p className="mt-1 text-sm text-[#525252]">{formatWeekDate(selectedDuty.weekStart)} - {formatWeekDate(selectedDuty.weekEnd)}</p>
                <p className="mt-2 inline-flex rounded-full bg-[#fff7ed] px-2.5 py-1 text-xs font-semibold text-[#c2410c]">{getCourseDisplayName(dutyCourse)}</p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row lg:items-center">
                {currentDuties.length > 1 && (
                  <select value={selectedDuty.id} onChange={event => setSelectedDutyId(Number(event.target.value))} className="h-10 rounded-lg border border-[#d4d4d4] bg-white px-3 text-sm text-[#171717]" aria-label="Duty assignment">
                    {currentDuties.map(duty => {
                      const course = courses.find(c => c.id === duty.courseId);
                      return <option key={duty.id} value={duty.id}>{course ? getCourseDisplayName(course) : `Course ${duty.courseId}`}</option>;
                    })}
                  </select>
                )}
                <button type="button" onClick={() => setTransferOpen(true)} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#e5e5e5] bg-white px-3 text-sm font-semibold text-[#525252] hover:bg-[#f5f5f5]">
                  <ArrowLeftRight className="h-4 w-4" />
                  Transfer
                </button>
              </div>
            </div>
          </div>
          <div className="grid gap-px bg-[#e5e5e5] sm:grid-cols-3">
            <div className="bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#737373]">Students</p>
              <p className="mt-1 text-2xl font-semibold text-[#171717]">{enrolledStudents.length}</p>
            </div>
            <div className="bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#737373]">Sessions</p>
              <p className="mt-1 text-2xl font-semibold text-[#171717]">{dutyTimeline.length}</p>
            </div>
            <div className="bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#737373]">Current</p>
              <p className="mt-1 truncate text-lg font-semibold text-[#171717]">{getTimelineTitle(selectedTimelineItem, currentUser)}</p>
            </div>
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
          <section className="rounded-2xl border border-[#e5e5e5] bg-white p-3 shadow-[0_18px_45px_rgba(15,23,42,0.04)]">
            <div className="mb-3 flex items-center justify-between gap-2 px-1">
              <div>
                <h3 className="font-semibold text-[#171717]">Sessions</h3>
                <p className="text-xs text-[#737373]">Choose what you are marking.</p>
              </div>
              <Users className="h-4 w-4 text-[#737373]" />
            </div>
            <div className="space-y-2">
              {dutyTimeline.map(item => {
                const key = getTimelineKey(item);
                const active = key === selectedTimelineKey;
                const saved = item.type === 'class'
                  ? classHasSavedAttendance(item.cls.id, enrolledStudents, classAttendance, savedClassIds)
                  : wellHasSavedAttendance(selectedDuty.weekStart, dutyCourse.id, enrolledStudents, theWellSessionAttendance, wellSaved);
                return (
                  <button key={key} type="button" onClick={() => setSelectedTimelineKey(key)} className={`w-full rounded-xl border p-3 text-left transition ${active ? 'border-[#171717] bg-[#171717] text-white' : 'border-[#e5e5e5] bg-white text-[#171717] hover:bg-[#fafafa]'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{getTimelineTitle(item, currentUser)}</p>
                        <p className={`mt-1 text-xs ${active ? 'text-white/70' : 'text-[#737373]'}`}>{formatClassDate(getTimelineDate(item))}</p>
                        {item.type === 'class' && <p className={`mt-1 text-xs ${active ? 'text-white/70' : 'text-[#737373]'}`}>{formatSessionType(item.cls)}</p>}
                      </div>
                      {saved ? <CheckCircle className="h-4 w-4 shrink-0 text-[#16a34a]" /> : <AlertCircle className={`h-4 w-4 shrink-0 ${active ? 'text-white/70' : 'text-[#d97706]'}`} />}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-[#e5e5e5] bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,0.04)]">
            <div className="mb-4 flex flex-col gap-3 border-b border-[#e5e5e5] pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-semibold text-[#171717]">{getTimelineTitle(selectedTimelineItem, currentUser)}</h3>
                  {selectedSaved && <span className="inline-flex items-center gap-1 rounded-full bg-[#dcfce7] px-2 py-0.5 text-xs font-semibold text-[#166534]"><CheckCircle className="h-3.5 w-3.5" />Saved</span>}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[#737373]">
                  <span className="inline-flex items-center gap-1.5"><Calendar className="h-4 w-4 text-[#d97706]" />{formatClassDate(getTimelineDate(selectedTimelineItem))}</span>
                  {classItem && <span className="rounded-full bg-[#fff7ed] px-2 py-0.5 text-xs font-semibold text-[#c2410c]">{formatSessionType(classItem.cls)}</span>}
                </div>
              </div>
              <button type="button" onClick={() => classItem ? void handleSaveClass(classItem.cls.id) : void handleSaveWell()} disabled={selectedSaving || enrolledStudents.length === 0} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#171717] px-4 text-sm font-semibold text-white hover:bg-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-50">
                <Save className="h-4 w-4" />
                {selectedSaving ? 'Saving...' : 'Save Attendance'}
              </button>
            </div>
            {renderRosterCards(
              selectedDraft,
              (studentId, status) => classItem ? handleClassStatusChange(classItem.cls.id, studentId, status) : handleWellStatusChange(studentId, status),
              status => classItem ? markAllClass(classItem.cls.id, status) : markAllWell(status)
            )}
          </section>
        </div>

        {transferOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-2xl border border-[#e5e5e5] bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-[#171717]">Transfer Duty</h3>
                <button type="button" onClick={closeTransferModal} className="rounded-lg p-2 text-[#737373] hover:bg-[#f5f5f5]" aria-label="Close"><X className="h-5 w-5" /></button>
              </div>
              <div className="space-y-4">
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-[#171717]">Transfer to</span>
                  <select value={toStudentId} onChange={event => setToStudentId(event.target.value)} className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm">
                    <option value="">Select a student...</option>
                    {transferCandidates.map(student => <option key={student.id} value={student.id}>{student.name}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-[#171717]">Reason</span>
                  <textarea value={transferReason} onChange={event => setTransferReason(event.target.value)} rows={3} className="w-full rounded-lg border border-[#d4d4d4] px-3 py-2 text-sm" placeholder="Optional" />
                </label>
                <p className="rounded-lg bg-[#f5f5f5] px-3 py-2 text-sm text-[#525252]">An admin will review this transfer request.</p>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={closeTransferModal} className="rounded-lg px-4 py-2 text-sm font-semibold text-[#525252] hover:bg-[#f5f5f5]">Cancel</button>
                  <button type="button" onClick={handleSendTransfer} disabled={!toStudentId || submittingTransfer} className="rounded-lg bg-[#171717] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{submittingTransfer ? 'Sending...' : 'Send Request'}</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow border border-gray-200 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-start sm:justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">On Duty This Week 🎓</h2>
            <p className="text-gray-600 mt-1">
              Week of {formatWeekDate(selectedDuty.weekStart)} – {formatWeekDate(selectedDuty.weekEnd)}
            </p>
            <p className="text-sm font-medium text-amber-700 mt-2">
              {getCourseDisplayName(dutyCourse)}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
            {currentDuties.length > 1 && (
              <label className="w-full sm:w-64">
                <span className="mb-1 block text-xs font-medium text-gray-500">Duty assignment</span>
                <select
                  value={selectedDuty.id}
                  onChange={event => setSelectedDutyId(Number(event.target.value))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:ring-amber-500"
                >
                  {currentDuties.map(duty => {
                    const course = courses.find(c => c.id === duty.courseId);
                    return (
                      <option key={duty.id} value={duty.id}>
                        {course ? getCourseDisplayName(course) : `Course ${duty.courseId}`}
                      </option>
                    );
                  })}
                </select>
              </label>
            )}
            <button
              type="button"
              onClick={() => setTransferOpen(true)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm font-medium transition-colors"
            >
              <ArrowLeftRight className="w-4 h-4" />
              Transfer Duty
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {dutyTimeline.length === 0 ? (
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6 text-center text-gray-500">
            No sessions scheduled for today.
          </div>
        ) : (
          dutyTimeline.map(item => {
            if (item.type === 'class') {
              const { cls, subject } = item;
              const isSaved = classHasSavedAttendance(
                cls.id,
                enrolledStudents,
                classAttendance,
                savedClassIds
              );
              const isSaving = savingClassId === cls.id;
              const draft = classDrafts[cls.id] ?? {};

              return (
                <div
                  key={`class-${cls.id}`}
                  className="bg-white rounded-lg shadow border border-gray-200 p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {getClassDisplayTitle(cls, subject, currentUser.roles)}
                      </h3>
                      <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-gray-600">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-amber-600" />
                          {formatClassDate(cls.date)}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800">
                          {formatSessionType(cls)}
                        </span>
                      </div>
                    </div>
                    {isSaved && (
                      <span className="flex items-center gap-1.5 text-sm font-medium text-green-700">
                        <CheckCircle className="w-4 h-4" />
                        Saved ✓
                      </span>
                    )}
                  </div>

                  {renderAttendanceTable(
                    draft,
                    (studentId, status) => handleClassStatusChange(cls.id, studentId, status),
                    `attendance-${cls.id}`
                  )}

                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleSaveClass(cls.id)}
                      disabled={isSaving}
                      className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors"
                    >
                      {isSaving ? 'Saving…' : 'Save Attendance'}
                    </button>
                  </div>
                </div>
              );
            }

            const isSaved = wellHasSavedAttendance(
              selectedDuty.weekStart,
              dutyCourse.id,
              enrolledStudents,
              theWellSessionAttendance,
              wellSaved
            );

            return (
              <div
                key="well"
                className="bg-white rounded-lg shadow border border-gray-200 p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">The Well</h3>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-gray-600">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-amber-600" />
                        {formatClassDate(item.date)}
                      </span>
                    </div>
                  </div>
                  {isSaved && (
                    <span className="flex items-center gap-1.5 text-sm font-medium text-green-700">
                      <CheckCircle className="w-4 h-4" />
                      Saved ✓
                    </span>
                  )}
                </div>

                {renderAttendanceTable(
                  wellDrafts,
                  handleWellStatusChange,
                  'well-attendance'
                )}

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveWell}
                    disabled={savingWell}
                    className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors"
                  >
                    {savingWell ? 'Saving…' : 'Save Attendance'}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {transferOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Transfer Duty</h3>
              <button
                type="button"
                onClick={closeTransferModal}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="transfer-student" className="block text-sm font-medium text-gray-700 mb-2">
                  Transfer to
                </label>
                <select
                  id="transfer-student"
                  value={toStudentId}
                  onChange={e => setToStudentId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-amber-500 focus:border-amber-500"
                >
                  <option value="">Select a student…</option>
                  {transferCandidates.map(student => (
                    <option key={student.id} value={student.id}>
                      {student.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="transfer-reason" className="block text-sm font-medium text-gray-700 mb-2">
                  Reason (optional)
                </label>
                <textarea
                  id="transfer-reason"
                  value={transferReason}
                  onChange={e => setTransferReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-amber-500 focus:border-amber-500"
                  placeholder="Why do you need to transfer duty?"
                />
              </div>

              <p className="text-sm text-gray-500">
                Your transfer request will be reviewed by an admin.
              </p>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeTransferModal}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSendTransfer}
                  disabled={!toStudentId || submittingTransfer}
                  className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors"
                >
                  {submittingTransfer ? 'Sending…' : 'Send Request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
