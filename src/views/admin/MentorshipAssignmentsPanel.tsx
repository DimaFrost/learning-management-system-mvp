import { Fragment, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Plus, UserCheck } from 'lucide-react';
import type { User, Course, CourseStudent, MentorshipLog } from '../../types/lms';
import { MentorAssignModal } from '../../components/modals/MentorAssignModal';
import { formatPlatformDate } from '../../utils/dateUtils';
import {
  EmptyState,
  FilterChip,
  PersonAvatar,
  progressStyles,
  SearchField,
  SectionCard,
} from './mentorshipShared';

interface MentorshipAssignmentsPanelProps {
  users: User[];
  courseStudents: CourseStudent[];
  courses: Course[];
  mentorshipLogs: MentorshipLog[];
  getUserById: (id: string | null) => User | undefined;
  getCourseDisplayName: (course: Course) => string;
  onAssignMentor: (studentId: string, courseId: number, mentorId: string) => Promise<void>;
  onOpenCheckin: (studentId: string, existingLog?: MentorshipLog) => void;
}

type ViewMode = 'pairs' | 'unassigned';

export function MentorshipAssignmentsPanel({
  users,
  courseStudents,
  courses,
  mentorshipLogs,
  getUserById,
  getCourseDisplayName,
  onAssignMentor,
  onOpenCheckin,
}: MentorshipAssignmentsPanelProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('pairs');
  const [search, setSearch] = useState('');
  const [expandedPairs, setExpandedPairs] = useState<Set<string>>(new Set());
  const [editingPair, setEditingPair] = useState<{ studentId: string; mentorId: string | null; courseId?: number } | null>(null);

  const mentorshipPairs = useMemo(() => {
    return courseStudents
      .filter(enrollment => enrollment.mentorId)
      .map(enrollment => {
        const student = getUserById(enrollment.studentId);
        const mentor = getUserById(enrollment.mentorId);
        const course = courses.find(c => c.id === enrollment.courseId);
        const studentLogs = mentorshipLogs
          .filter(log => log.studentId === enrollment.studentId)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const latestLog = studentLogs[0];

        return {
          ...enrollment,
          student,
          mentor,
          course,
          totalCheckins: studentLogs.length,
          latestCheckin: latestLog?.date,
          latestProgress: latestLog?.studentProgress,
          allLogs: studentLogs,
          pairKey: `${enrollment.studentId}-${enrollment.mentorId}-${enrollment.courseId}`,
        };
      });
  }, [courseStudents, courses, getUserById, mentorshipLogs]);

  const studentsWithoutMentors = useMemo(() => {
    return users
      .filter(user => user.roles.includes('student'))
      .filter(student => {
        const enrollments = courseStudents.filter(cs => cs.studentId === student.id);
        if (enrollments.length === 0) return true;
        return !enrollments.some(cs => cs.mentorId);
      });
  }, [courseStudents, users]);

  const getEnrollmentForStudent = (studentId: string) =>
    courseStudents.find(cs => cs.studentId === studentId && !cs.mentorId)
    ?? courseStudents.find(cs => cs.studentId === studentId);

  const query = search.trim().toLowerCase();

  const filteredPairs = useMemo(() => {
    if (!query) return mentorshipPairs;
    return mentorshipPairs.filter(pair => {
      const haystack = [
        pair.student?.name,
        pair.mentor?.name,
        pair.course ? getCourseDisplayName(pair.course) : '',
      ].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [getCourseDisplayName, mentorshipPairs, query]);

  const filteredUnassigned = useMemo(() => {
    if (!query) return studentsWithoutMentors;
    return studentsWithoutMentors.filter(student =>
      `${student.name} ${student.email}`.toLowerCase().includes(query)
    );
  }, [query, studentsWithoutMentors]);

  const togglePairExpansion = (pairKey: string) => {
    setExpandedPairs(prev => {
      const next = new Set(prev);
      if (next.has(pairKey)) next.delete(pairKey);
      else next.add(pairKey);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <SectionCard className="p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            <FilterChip
              active={viewMode === 'pairs'}
              label="Active pairs"
              count={mentorshipPairs.length}
              onClick={() => setViewMode('pairs')}
              tone="info"
            />
            <FilterChip
              active={viewMode === 'unassigned'}
              label="Needs mentor"
              count={studentsWithoutMentors.length}
              onClick={() => setViewMode('unassigned')}
              tone={studentsWithoutMentors.length > 0 ? 'warning' : 'neutral'}
            />
          </div>
          <div className="w-full lg:max-w-xs">
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder={viewMode === 'pairs' ? 'Search pairs…' : 'Search students…'}
            />
          </div>
        </div>
      </SectionCard>

      {viewMode === 'unassigned' ? (
        filteredUnassigned.length > 0 ? (
          <SectionCard className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[#e5e5e5] text-sm">
                <thead className="bg-[#fafafa]">
                  <tr>
                    {['Student', 'Email', 'Course', ''].map(column => (
                      <th key={column || 'action'} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0f0f0]">
                  {filteredUnassigned.map(student => {
                    const enrollment = getEnrollmentForStudent(student.id);
                    const course = enrollment ? courses.find(c => c.id === enrollment.courseId) : undefined;
                    return (
                      <tr key={student.id} className="bg-white hover:bg-[#fafafa]">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <PersonAvatar name={student.name} tone="alert" size="sm" />
                            <span className="font-medium text-[#171717]">{student.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[#525252]">{student.email}</td>
                        <td className="px-4 py-3 text-[#525252]">
                          {course ? getCourseDisplayName(course) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setEditingPair({
                              studentId: student.id,
                              mentorId: null,
                              courseId: enrollment?.courseId,
                            })}
                            className="inline-flex items-center gap-1 rounded-lg bg-[#171717] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#262626]"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Assign mentor
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SectionCard>
        ) : (
          <EmptyState
            icon={UserCheck}
            title={query ? 'No students match your search' : 'All students have mentors'}
            description={query ? 'Try a different name or email.' : 'Great work — every enrolled student is paired.'}
          />
        )
      ) : filteredPairs.length > 0 ? (
        <SectionCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-[960px] divide-y divide-[#e5e5e5] text-sm">
              <thead className="bg-[#fafafa]">
                <tr>
                  {['Student', 'Mentor', 'Course', 'Last check-in', 'Check-ins', 'Progress', 'Actions'].map(column => (
                    <th key={column} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f0f0]">
                {filteredPairs.map(pair => {
                  const isExpanded = expandedPairs.has(pair.pairKey);
                  return (
                    <Fragment key={pair.pairKey}>
                      <tr className="bg-white hover:bg-[#fafafa]">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <PersonAvatar name={pair.student?.name ?? '?'} tone="student" size="sm" />
                            <div>
                              <p className="font-medium text-[#171717]">{pair.student?.name ?? 'Unknown'}</p>
                              <p className="text-xs text-[#737373]">Student</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <PersonAvatar name={pair.mentor?.name ?? '?'} tone="mentor" size="sm" />
                            <div>
                              <p className="font-medium text-[#171717]">{pair.mentor?.name ?? 'Unknown'}</p>
                              <p className="text-xs text-[#737373]">Mentor</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[#525252]">
                          {pair.course ? getCourseDisplayName(pair.course) : '—'}
                        </td>
                        <td className="px-4 py-3 text-[#525252]">
                          {pair.latestCheckin ? formatPlatformDate(pair.latestCheckin) : (
                            <span className="text-[#a3a3a3]">None yet</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium text-[#171717]">{pair.totalCheckins}</td>
                        <td className="px-4 py-3">
                          {pair.latestProgress ? (
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${progressStyles[pair.latestProgress] ?? 'bg-[#f5f5f5] text-[#525252]'}`}>
                              {pair.latestProgress.replace(/_/g, ' ')}
                            </span>
                          ) : (
                            <span className="text-[#a3a3a3]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => onOpenCheckin(pair.studentId, pair.allLogs[0])}
                              className="rounded-lg bg-[#171717] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#262626]"
                            >
                              Log check-in
                            </button>
                            <button
                              type="button"
                              onClick={() => togglePairExpansion(pair.pairKey)}
                              className="inline-flex items-center gap-1 rounded-lg border border-[#d4d4d4] px-2.5 py-1.5 text-xs font-semibold text-[#525252] hover:bg-[#f5f5f5]"
                            >
                              History
                              {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingPair({
                                studentId: pair.studentId,
                                mentorId: pair.mentorId,
                                courseId: pair.courseId,
                              })}
                              className="rounded-lg border border-[#d4d4d4] px-2.5 py-1.5 text-xs font-semibold text-[#525252] hover:bg-[#f5f5f5]"
                            >
                              Change
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${pair.pairKey}-history`} className="bg-[#fafafa]">
                          <td colSpan={7} className="px-4 py-4">
                            {pair.allLogs.length > 0 ? (
                              <div className="grid gap-2 md:grid-cols-2">
                                {pair.allLogs.map(log => (
                                  <div key={log.id} className="rounded-lg border border-[#e5e5e5] bg-white p-3">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-sm font-medium text-[#171717]">
                                        {log.type === 'digital' ? 'Digital' : 'In-person'} check-in
                                      </span>
                                      <span className="text-xs text-[#737373]">{formatPlatformDate(log.date)}</span>
                                    </div>
                                    {log.notes && <p className="mt-2 text-sm text-[#525252]">{log.notes}</p>}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-[#737373]">No check-ins recorded for this pair yet.</p>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      ) : (
        <EmptyState
          icon={UserCheck}
          title={query ? 'No pairs match your search' : 'No mentorship pairs yet'}
          description={query ? 'Try another student, mentor, or course name.' : 'Assign mentors to students to start tracking check-ins.'}
          action={
            studentsWithoutMentors.length > 0 ? (
              <button
                type="button"
                onClick={() => setViewMode('unassigned')}
                className="rounded-lg bg-[#171717] px-4 py-2 text-sm font-semibold text-white hover:bg-[#262626]"
              >
                View unassigned students
              </button>
            ) : undefined
          }
        />
      )}

      <MentorAssignModal
        isOpen={!!editingPair}
        studentId={editingPair?.studentId ?? null}
        users={users}
        courseStudents={courseStudents}
        onClose={() => setEditingPair(null)}
        onAssign={async (studentId, mentorId) => {
          const courseId = editingPair?.courseId ?? getEnrollmentForStudent(studentId)?.courseId;
          if (courseId == null) {
            alert('This student must be enrolled in a course before a mentor can be assigned.');
            return;
          }
          await onAssignMentor(studentId, courseId, mentorId);
          setEditingPair(null);
        }}
      />
    </div>
  );
}
