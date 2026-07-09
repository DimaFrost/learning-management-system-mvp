import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  CheckCircle,
  Calendar,
  ArrowLeftRight,
  X,
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
import { getCourseDisplayName, getClassDisplayTitle } from '../../utils/courseUtils';
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

function getDayOfWeek(dateStr: string): number {
  return new Date(dateStr + 'T00:00:00').getDay();
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

  const enrolledStudents = useMemo(() => {
    if (!selectedDuty) return [];
    const enrolledIds = courseStudents
      .filter(cs => cs.courseId === selectedDuty.courseId)
      .map(cs => cs.studentId);
    const enrolledUsers = users.filter(u => enrolledIds.includes(u.id));
    return sortByFirstName(enrolledUsers);
  }, [courseStudents, selectedDuty, users]);

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

  const showWell = useMemo(() => {
    if (!selectedDuty || !dutyCourse) return false;
    const courseWellEntries = wellSchedule.filter(entry => entry.courseId === dutyCourse.id);
    if (courseWellEntries.length > 0) {
      return courseWellEntries.some(entry => entry.weekStart === selectedDuty.weekStart);
    }
    return classesThisWeek.some(c => getDayOfWeek(c.cls.date) === 2)
      && classesThisWeek.some(c => getDayOfWeek(c.cls.date) === 4);
  }, [classesThisWeek, dutyCourse, selectedDuty, wellSchedule]);

  const dutyTimeline = useMemo(
    () => selectedDuty
      ? buildDutyTimeline(classesThisWeek, selectedDuty.weekStart, showWell)
      : [],
    [classesThisWeek, selectedDuty, showWell]
  );

  useEffect(() => {
    setClassDrafts(
      buildClassDrafts(classesThisWeek.map(({ cls }) => cls), enrolledStudents, classAttendance)
    );
  }, [classesThisWeek, enrolledStudents, classAttendance]);

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
    },
    []
  );

  const handleWellStatusChange = useCallback(
    (studentId: string, status: AttendanceStatus) => {
      setWellDrafts(prev => ({ ...prev, [studentId]: status }));
      setWellSaved(false);
    },
    []
  );

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
  ) => (
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
            No sessions scheduled this week.
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
