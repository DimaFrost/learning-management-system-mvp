import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  CheckCircle,
  Clock,
  XCircle,
  Calendar,
  Users,
  ArrowLeftRight,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type {
  User,
  Course,
  CourseStudent,
  Class,
  AttendanceSettings,
  AttendanceStatus,
  ClassAttendanceRecord,
  TheWellAttendanceRecord,
  DutyScheduleEntry,
  Subject,
} from '../../types/lms';
import { getCourseDisplayName, getClassDisplayTitle } from '../../utils/courseUtils';
import { sortByFirstName, formatMonthYear } from '../../utils/attendanceUtils';

interface DutyMarkingViewProps {
  currentUser: User;
  myCurrentDuty: DutyScheduleEntry;
  courses: Course[];
  courseStudents: CourseStudent[];
  users: User[];
  classAttendance: ClassAttendanceRecord[];
  theWellAttendance: TheWellAttendanceRecord[];
  settings: AttendanceSettings;
  onMarkClassAttendance: (
    classId: number,
    records: Array<{ studentId: string; status: AttendanceStatus }>
  ) => Promise<void>;
  onUpsertTheWellAttendance: (
    studentId: string,
    courseId: number,
    year: number,
    month: number,
    timesAttended: number,
    timesLate: number
  ) => Promise<void>;
  onRequestTransfer: (params: {
    dutyScheduleId: number;
    toStudentId: string;
    reason?: string;
  }) => Promise<void>;
  loading?: boolean;
}

type TabId = 'class' | 'well';

const HOUR_ORDER: Record<Class['hour'], number> = { first: 0, second: 1, both: 2 };

function formatWeekDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatClassDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatHourLabel(hour: Class['hour']): string {
  switch (hour) {
    case 'first':
      return 'First Hour';
    case 'second':
      return 'Second Hour';
    case 'both':
      return 'Activation Saturday';
  }
}

function getWellEffectiveScoreDisplay(
  attended: number,
  late: number,
  settings: AttendanceSettings
): { label: string; className: string; Icon: typeof CheckCircle } {
  const effective = attended + late * settings.lateWellWeight;
  const score = Math.min(1, effective / settings.theWellRequiredPerMonth);
  const pct = Math.round(score * 100);
  if (score >= 1) {
    return { label: '100% ✅', className: 'text-green-700', Icon: CheckCircle };
  }
  if (score >= 0.5) {
    return { label: `${pct}% ⚠️`, className: 'text-amber-600', Icon: Clock };
  }
  return { label: `${pct}% ❌`, className: 'text-red-600', Icon: XCircle };
}

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
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
  records: TheWellAttendanceRecord[],
  courseId: number,
  year: number,
  month: number
): Record<string, { attended: number; late: number }> {
  const drafts: Record<string, { attended: number; late: number }> = {};
  for (const student of students) {
    const existing = records.find(
      r => r.studentId === student.id && r.courseId === courseId && r.year === year && r.month === month
    );
    drafts[student.id] = {
      attended: existing?.timesAttended ?? 0,
      late: existing?.timesLate ?? 0,
    };
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

export function DutyMarkingView({
  currentUser,
  myCurrentDuty,
  courses,
  courseStudents,
  users,
  classAttendance,
  theWellAttendance,
  settings,
  onMarkClassAttendance,
  onUpsertTheWellAttendance,
  onRequestTransfer,
  loading,
}: DutyMarkingViewProps) {
  const today = new Date();
  const [activeTab, setActiveTab] = useState<TabId>('class');
  const [transferOpen, setTransferOpen] = useState(false);
  const [toStudentId, setToStudentId] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [submittingTransfer, setSubmittingTransfer] = useState(false);
  const [classDrafts, setClassDrafts] = useState<Record<number, Record<string, AttendanceStatus>>>({});
  const [savingClassId, setSavingClassId] = useState<number | null>(null);
  const [savedClassIds, setSavedClassIds] = useState<Set<number>>(new Set());
  const [wellMonth, setWellMonth] = useState({
    year: today.getFullYear(),
    month: today.getMonth() + 1,
  });
  const [wellDrafts, setWellDrafts] = useState<Record<string, { attended: number; late: number }>>({});
  const [savingWell, setSavingWell] = useState(false);
  const [wellSaved, setWellSaved] = useState(false);

  const dutyCourse = courses.find(c => c.id === myCurrentDuty.courseId);

  const enrolledStudents = useMemo(() => {
    const enrolledIds = courseStudents
      .filter(cs => cs.courseId === myCurrentDuty.courseId)
      .map(cs => cs.studentId);
    const enrolledUsers = users.filter(u => enrolledIds.includes(u.id));
    return sortByFirstName(enrolledUsers);
  }, [courseStudents, myCurrentDuty.courseId, users]);

  const transferCandidates = useMemo(
    () => enrolledStudents.filter(s => s.id !== currentUser.id),
    [enrolledStudents, currentUser.id]
  );

  const classesThisWeek = useMemo(() => {
    if (!dutyCourse) return [];
    const { weekStart, weekEnd } = myCurrentDuty;
    return dutyCourse.subjects
      .flatMap((subject: Subject) =>
        subject.classes
          .filter(cls => cls.date && cls.date >= weekStart && cls.date <= weekEnd)
          .map(cls => ({ cls, subject }))
      )
      .sort((a, b) => {
        const dateCmp = a.cls.date.localeCompare(b.cls.date);
        if (dateCmp !== 0) return dateCmp;
        return HOUR_ORDER[a.cls.hour] - HOUR_ORDER[b.cls.hour];
      });
  }, [dutyCourse, myCurrentDuty]);

  useEffect(() => {
    setClassDrafts(buildClassDrafts(classesThisWeek.map(({ cls }) => cls), enrolledStudents, classAttendance));
  }, [classesThisWeek, enrolledStudents, classAttendance]);

  useEffect(() => {
    if (!dutyCourse) return;
    setWellDrafts(
      buildWellDrafts(
        enrolledStudents,
        theWellAttendance,
        dutyCourse.id,
        wellMonth.year,
        wellMonth.month
      )
    );
    setWellSaved(false);
  }, [enrolledStudents, theWellAttendance, dutyCourse, wellMonth.year, wellMonth.month]);

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

  const handleWellChange = (
    studentId: string,
    field: 'attended' | 'late',
    value: number
  ) => {
    const clamped = Math.min(10, Math.max(0, value));
    setWellDrafts(prev => ({
      ...prev,
      [studentId]: { ...(prev[studentId] ?? { attended: 0, late: 0 }), [field]: clamped },
    }));
    setWellSaved(false);
  };

  const handleSaveWell = async () => {
    if (!dutyCourse) return;
    setSavingWell(true);
    try {
      const updates = enrolledStudents.filter(student => {
        const draft = wellDrafts[student.id] ?? { attended: 0, late: 0 };
        const existing = theWellAttendance.find(
          r => r.studentId === student.id
            && r.courseId === dutyCourse.id
            && r.year === wellMonth.year
            && r.month === wellMonth.month
        );
        return (existing?.timesAttended ?? 0) !== draft.attended
          || (existing?.timesLate ?? 0) !== draft.late;
      });

      await Promise.all(
        updates.map(student => {
          const draft = wellDrafts[student.id] ?? { attended: 0, late: 0 };
          return onUpsertTheWellAttendance(
            student.id,
            dutyCourse.id,
            wellMonth.year,
            wellMonth.month,
            draft.attended,
            draft.late
          );
        })
      );
      setWellSaved(true);
    } finally {
      setSavingWell(false);
    }
  };

  const handleSendTransfer = async () => {
    if (!toStudentId) return;
    setSubmittingTransfer(true);
    try {
      await onRequestTransfer({
        dutyScheduleId: myCurrentDuty.id,
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

  if (!dutyCourse) {
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
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">On Duty This Week 🎓</h2>
            <p className="text-gray-600 mt-1">
              Week of {formatWeekDate(myCurrentDuty.weekStart)} – {formatWeekDate(myCurrentDuty.weekEnd)}
            </p>
            <p className="text-sm font-medium text-amber-700 mt-2">
              {getCourseDisplayName(dutyCourse)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setTransferOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm font-medium transition-colors"
          >
            <ArrowLeftRight className="w-4 h-4" />
            Transfer Duty
          </button>
        </div>
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex gap-6" aria-label="Duty marking tabs">
          <button
            type="button"
            onClick={() => setActiveTab('class')}
            className={`flex items-center gap-2 pb-3 text-sm transition-colors ${
              activeTab === 'class'
                ? 'border-b-2 border-amber-600 text-amber-700 font-medium'
                : 'text-gray-500 hover:text-amber-600'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Mark Class Attendance
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('well')}
            className={`flex items-center gap-2 pb-3 text-sm transition-colors ${
              activeTab === 'well'
                ? 'border-b-2 border-amber-600 text-amber-700 font-medium'
                : 'text-gray-500 hover:text-amber-600'
            }`}
          >
            <Users className="w-4 h-4" />
            The Well
          </button>
        </nav>
      </div>

      {activeTab === 'class' && (
        <div className="space-y-4">
          {classesThisWeek.length === 0 ? (
            <div className="bg-white rounded-lg shadow border border-gray-200 p-6 text-center text-gray-500">
              No classes scheduled this week.
            </div>
          ) : (
            classesThisWeek.map(({ cls, subject }) => {
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
                  key={cls.id}
                  className="bg-white rounded-lg shadow border border-gray-200 p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{getClassDisplayTitle(cls, subject, currentUser.roles)}</h3>
                      <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-gray-600">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-amber-600" />
                          {formatClassDate(cls.date)}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800">
                          {formatHourLabel(cls.hour)}
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
                                  name={`attendance-${cls.id}-${student.id}`}
                                  checked={(draft[student.id] ?? 'absent') === status}
                                  onChange={() => handleClassStatusChange(cls.id, student.id, status)}
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
            })
          )}
        </div>
      )}

      {activeTab === 'well' && (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setWellMonth(prev => shiftMonth(prev.year, prev.month, -1))}
              className="flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 text-gray-600 hover:text-amber-700 hover:border-amber-300 transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-semibold text-gray-900">
              {formatMonthYear(wellMonth.year, wellMonth.month)}
            </h3>
            <button
              type="button"
              onClick={() => setWellMonth(prev => shiftMonth(prev.year, prev.month, 1))}
              className="flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 text-gray-600 hover:text-amber-700 hover:border-amber-300 transition-colors"
              aria-label="Next month"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-3">
            {enrolledStudents.map(student => {
              const draft = wellDrafts[student.id] ?? { attended: 0, late: 0 };
              const score = getWellEffectiveScoreDisplay(
                draft.attended, draft.late, settings
              );
              const ScoreIcon = score.Icon;

              return (
                <div
                  key={student.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-2 border-b border-gray-100 last:border-0"
                >
                  <span className="font-medium text-gray-900 min-w-[140px]">{student.name}</span>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="text-sm text-gray-600 whitespace-nowrap flex items-center gap-2">
                      On time:
                      <input
                        type="number"
                        min={0}
                        max={10}
                        value={draft.attended}
                        onChange={e => handleWellChange(
                          student.id, 'attended', parseInt(e.target.value, 10) || 0
                        )}
                        className="w-16 px-2 py-1 border border-gray-300 rounded-lg text-sm text-center focus:ring-amber-500 focus:border-amber-500"
                      />
                    </label>
                    <label className="text-sm text-gray-600 whitespace-nowrap flex items-center gap-2">
                      Late:
                      <input
                        type="number"
                        min={0}
                        max={10}
                        value={draft.late}
                        onChange={e => handleWellChange(
                          student.id, 'late', parseInt(e.target.value, 10) || 0
                        )}
                        className="w-16 px-2 py-1 border border-gray-300 rounded-lg text-sm text-center focus:ring-amber-500 focus:border-amber-500"
                      />
                    </label>
                    <span className={`flex items-center gap-1 text-sm font-medium ${score.className}`}>
                      <ScoreIcon className="w-4 h-4" />
                      {score.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-2">
            {wellSaved && (
              <span className="flex items-center gap-1.5 text-sm font-medium text-green-700">
                <CheckCircle className="w-4 h-4" />
                Saved ✓
              </span>
            )}
            <div className={wellSaved ? '' : 'ml-auto'}>
              <button
                type="button"
                onClick={handleSaveWell}
                disabled={savingWell}
                className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors"
              >
                {savingWell ? 'Saving…' : 'Save The Well Attendance'}
              </button>
            </div>
          </div>
        </div>
      )}

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
