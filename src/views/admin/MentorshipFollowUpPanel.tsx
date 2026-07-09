import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle, Mail, Search } from 'lucide-react';
import type { User, CourseStudent, MentorshipLog } from '../../types/lms';
import type { CadenceSettings } from '../../hooks/useCadenceSettings';
import { calculateOverallStatus, getCheckInStatus } from '../../utils/mentorshipUtils';
import { ContactMentorModal } from '../../components/modals/ContactMentorModal';
import {
  CheckInStatusBadge,
  EmptyState,
  FilterChip,
  OverallStatusBadge,
  PersonAvatar,
  SearchField,
  SectionCard,
} from './mentorshipShared';

interface MentorshipFollowUpPanelProps {
  users: User[];
  courseStudents: CourseStudent[];
  cadenceSettings: CadenceSettings;
  mentorshipLogs: MentorshipLog[];
  getUserById: (id: string | null) => User | undefined;
  onOpenCheckin: (studentId: string) => void;
}

type StatusFilter = 'all' | 'at_risk' | 'lagging' | 'on_track';

const statusPriority: Record<string, number> = {
  at_risk: 0,
  lagging: 1,
  on_track: 2,
};

export function MentorshipFollowUpPanel({
  courseStudents,
  cadenceSettings,
  mentorshipLogs,
  getUserById,
  onOpenCheckin,
}: MentorshipFollowUpPanelProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [contactMentor, setContactMentor] = useState<User | null>(null);

  const analytics = useMemo(() => {
    const studentMap = new Map<string, {
      id: string;
      studentName: string;
      mentorName: string;
      mentorId: string | null;
      overallStatus: string;
      inPersonStatus: ReturnType<typeof getCheckInStatus>;
    }>();

    courseStudents.forEach(cs => {
      const studentId = cs.studentId;
      if (studentMap.has(studentId)) return;

      const student = getUserById(studentId);
      const mentor = getUserById(cs.mentorId);
      studentMap.set(studentId, {
        id: studentId,
        studentName: student?.name || 'Unknown',
        mentorName: mentor?.name || 'Unassigned',
        mentorId: cs.mentorId,
        overallStatus: calculateOverallStatus(studentId, mentorshipLogs, cadenceSettings),
        inPersonStatus: getCheckInStatus(studentId, 'in_person', mentorshipLogs, cadenceSettings),
      });
    });

    const allStudents = Array.from(studentMap.values());
    return {
      totalPairs: allStudents.length,
      atRiskPairs: allStudents.filter(pair => pair.overallStatus === 'at_risk').length,
      laggingPairs: allStudents.filter(pair => pair.overallStatus === 'lagging').length,
      onTrackPairs: allStudents.filter(pair => pair.overallStatus === 'on_track').length,
      allStudents,
    };
  }, [cadenceSettings, courseStudents, getUserById, mentorshipLogs]);

  const query = search.trim().toLowerCase();

  const filteredStudents = useMemo(() => {
    return analytics.allStudents
      .filter(pair => statusFilter === 'all' || pair.overallStatus === statusFilter)
      .filter(pair => {
        if (!query) return true;
        return `${pair.studentName} ${pair.mentorName}`.toLowerCase().includes(query);
      })
      .sort((a, b) => {
        const priorityDiff = (statusPriority[a.overallStatus] ?? 9) - (statusPriority[b.overallStatus] ?? 9);
        if (priorityDiff !== 0) return priorityDiff;
        return a.studentName.localeCompare(b.studentName);
      });
  }, [analytics.allStudents, query, statusFilter]);

  const priorityPairs = analytics.allStudents
    .filter(pair => pair.overallStatus === 'at_risk')
    .slice(0, 5);

  return (
    <div className="space-y-4">
      <SectionCard className="p-4">
        <p className="text-sm text-[#737373]">
          Status is based on <strong className="font-medium text-[#525252]">in-person meetings</strong> only.
          Digital check-ins are optional and do not affect these flags.
        </p>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            <FilterChip active={statusFilter === 'all'} label="All" count={analytics.totalPairs} onClick={() => setStatusFilter('all')} tone="info" />
            <FilterChip active={statusFilter === 'at_risk'} label="At risk" count={analytics.atRiskPairs} onClick={() => setStatusFilter('at_risk')} tone="danger" />
            <FilterChip active={statusFilter === 'lagging'} label="Lagging" count={analytics.laggingPairs} onClick={() => setStatusFilter('lagging')} tone="warning" />
            <FilterChip active={statusFilter === 'on_track'} label="On track" count={analytics.onTrackPairs} onClick={() => setStatusFilter('on_track')} tone="success" />
          </div>
          <div className="w-full lg:max-w-xs">
            <SearchField value={search} onChange={setSearch} placeholder="Search student or mentor…" />
          </div>
        </div>
      </SectionCard>

      {priorityPairs.length > 0 && statusFilter !== 'on_track' && (
        <SectionCard className="overflow-hidden border-[#fecaca]">
          <div className="flex items-center gap-2 border-b border-[#fecaca] bg-[#fef2f2] px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-[#b91c1c]" />
            <div>
              <h3 className="font-semibold text-[#991b1b]">Priority follow-up</h3>
              <p className="text-xs text-[#b91c1c]">Pairs overdue on in-person meetings.</p>
            </div>
          </div>
          <div className="divide-y divide-[#fecaca]/60">
            {priorityPairs.map(pair => (
              <div key={pair.id} className="flex flex-col gap-3 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <PersonAvatar name={pair.studentName} tone="student" size="sm" />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[#171717]">{pair.studentName}</p>
                    <p className="truncate text-xs text-[#737373]">Mentor: {pair.mentorName}</p>
                    <div className="mt-2">
                      <CheckInStatusBadge status={pair.inPersonStatus.status} message={`In person · ${pair.inPersonStatus.message}`} />
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenCheckin(pair.id)}
                    className="rounded-lg bg-[#b91c1c] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#991b1b]"
                  >
                    Log meeting
                  </button>
                  <button
                    type="button"
                    onClick={() => setContactMentor(getUserById(pair.mentorId) ?? null)}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#d4d4d4] px-3 py-1.5 text-xs font-semibold text-[#525252] hover:bg-[#f5f5f5]"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    Contact
                  </button>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      <SectionCard className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#e5e5e5] px-4 py-3">
          <div>
            <h3 className="font-semibold text-[#171717]">All pairs</h3>
            <p className="text-sm text-[#737373]">{filteredStudents.length} shown · sorted by urgency</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[760px] divide-y divide-[#e5e5e5] text-sm">
            <thead className="bg-[#fafafa]">
              <tr>
                {['Student', 'Mentor', 'Last in-person meeting', 'Overall', 'Actions'].map(column => (
                  <th key={column} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f0]">
              {filteredStudents.map(pair => (
                <tr key={pair.id} className="bg-white hover:bg-[#fafafa]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <PersonAvatar name={pair.studentName} tone="student" size="sm" />
                      <span className="font-medium text-[#171717]">{pair.studentName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <PersonAvatar name={pair.mentorName} tone="mentor" size="sm" />
                      <span className="text-[#525252]">{pair.mentorName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <CheckInStatusBadge status={pair.inPersonStatus.status} message={pair.inPersonStatus.message} />
                  </td>
                  <td className="px-4 py-3">
                    <OverallStatusBadge status={pair.overallStatus} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenCheckin(pair.id)}
                        className="rounded-lg border border-[#d4d4d4] px-2.5 py-1.5 text-xs font-semibold text-[#525252] hover:bg-[#f5f5f5]"
                      >
                        Log meeting
                      </button>
                      <button
                        type="button"
                        onClick={() => setContactMentor(getUserById(pair.mentorId) ?? null)}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#d4d4d4] px-2.5 py-1.5 text-xs font-semibold text-[#525252] hover:bg-[#f5f5f5]"
                      >
                        <Mail className="h-3.5 w-3.5" />
                        Contact
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10">
                    <EmptyState
                      icon={query ? Search : CheckCircle}
                      title={query ? 'No pairs match your search' : 'No pairs in this filter'}
                      description={query ? 'Try another student or mentor name.' : 'Switch filters to see more students.'}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {analytics.atRiskPairs === 0 && analytics.totalPairs > 0 && statusFilter === 'all' && !query && (
        <div className="rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-sm text-[#166534]">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle className="h-4 w-4" />
            All assigned pairs are meeting in-person meeting expectations.
          </div>
        </div>
      )}

      <ContactMentorModal mentor={contactMentor} onClose={() => setContactMentor(null)} />
    </div>
  );
}
