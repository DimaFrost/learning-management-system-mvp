import { Fragment, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Plus, UserCheck } from 'lucide-react';
import type { User, Course, CourseStudent, MentorshipLog } from '../../types/lms';
import { MentorAssignModal } from '../../components/modals/MentorAssignModal';
import { formatPlatformDate } from '../../utils/dateUtils';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
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

const unassignedColumns: TranslationKey[] = [
  'mentorship.assignments.column.student',
  'mentorship.assignments.column.email',
  'mentorship.assignments.column.course',
];

const pairsColumns: TranslationKey[] = [
  'mentorship.assignments.column.student',
  'mentorship.assignments.column.mentor',
  'mentorship.assignments.column.course',
  'mentorship.assignments.column.lastCheckin',
  'mentorship.assignments.column.checkins',
  'mentorship.assignments.column.progress',
  'mentorship.assignments.column.actions',
];

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
  const { t } = useLanguage();
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
          latestProgress: latestLog?.engagement ?? latestLog?.studentProgress,
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
              label={t('mentorship.assignments.activePairs')}
              count={mentorshipPairs.length}
              onClick={() => setViewMode('pairs')}
              tone="info"
            />
            <FilterChip
              active={viewMode === 'unassigned'}
              label={t('mentorship.assignments.needsMentor')}
              count={studentsWithoutMentors.length}
              onClick={() => setViewMode('unassigned')}
              tone={studentsWithoutMentors.length > 0 ? 'warning' : 'neutral'}
            />
          </div>
          <div className="w-full lg:max-w-xs">
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder={viewMode === 'pairs' ? t('mentorship.assignments.searchPairs') : t('mentorship.assignments.searchStudents')}
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
                    {unassignedColumns.map(column => (
                      <th key={column} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">
                        {t(column)}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]" />
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
                            {t('mentorship.assignments.assignMentor')}
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
            title={query ? t('mentorship.assignments.emptySearchStudents.title') : t('mentorship.assignments.allHaveMentors.title')}
            description={query ? t('mentorship.assignments.emptySearchStudents.desc') : t('mentorship.assignments.allHaveMentors.desc')}
          />
        )
      ) : filteredPairs.length > 0 ? (
        <SectionCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-[960px] divide-y divide-[#e5e5e5] text-sm">
              <thead className="bg-[#fafafa]">
                <tr>
                  {pairsColumns.map(column => (
                    <th key={column} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">
                      {t(column)}
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
                              <p className="font-medium text-[#171717]">{pair.student?.name ?? t('common.unknown')}</p>
                              <p className="text-xs text-[#737373]">{t('mentorship.assignments.role.student')}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <PersonAvatar name={pair.mentor?.name ?? '?'} tone="mentor" size="sm" />
                            <div>
                              <p className="font-medium text-[#171717]">{pair.mentor?.name ?? t('common.unknown')}</p>
                              <p className="text-xs text-[#737373]">{t('mentorship.assignments.role.mentor')}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[#525252]">
                          {pair.course ? getCourseDisplayName(pair.course) : '—'}
                        </td>
                        <td className="px-4 py-3 text-[#525252]">
                          {pair.latestCheckin ? formatPlatformDate(pair.latestCheckin) : (
                            <span className="text-[#a3a3a3]">{t('mentorship.assignments.noneYet')}</span>
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
                              {t('mentorship.assignments.logCheckin')}
                            </button>
                            <button
                              type="button"
                              onClick={() => togglePairExpansion(pair.pairKey)}
                              className="inline-flex items-center gap-1 rounded-lg border border-[#d4d4d4] px-2.5 py-1.5 text-xs font-semibold text-[#525252] hover:bg-[#f5f5f5]"
                            >
                              {t('mentorship.assignments.history')}
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
                              {t('mentorship.assignments.change')}
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
                                        {log.type === 'digital' ? t('mentorship.assignments.digitalCheckin') : t('mentorship.assignments.inPersonCheckin')}
                                      </span>
                                      <span className="text-xs text-[#737373]">{formatPlatformDate(log.date)}</span>
                                    </div>
                                    {(log.mainTopic || log.notes) && (
                                      <p className="mt-2 text-sm text-[#525252]">{log.mainTopic || log.notes}</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-[#737373]">{t('mentorship.assignments.noCheckinsForPair')}</p>
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
          title={query ? t('mentorship.assignments.emptySearchPairs.title') : t('mentorship.assignments.noPairs.title')}
          description={query ? t('mentorship.assignments.emptySearchPairs.desc') : t('mentorship.assignments.noPairs.desc')}
          action={
            studentsWithoutMentors.length > 0 ? (
              <button
                type="button"
                onClick={() => setViewMode('unassigned')}
                className="rounded-lg bg-[#171717] px-4 py-2 text-sm font-semibold text-white hover:bg-[#262626]"
              >
                {t('mentorship.assignments.viewUnassigned')}
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
            alert(t('mentorship.assignments.enrollmentRequired'));
            return;
          }
          await onAssignMentor(studentId, courseId, mentorId);
          setEditingPair(null);
        }}
      />
    </div>
  );
}
