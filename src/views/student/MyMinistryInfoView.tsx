import { useMemo } from 'react';
import { Mail, Phone } from 'lucide-react';
import type { Course, CourseStudent, MinistryRotation, MinistryTeam, User } from '../../types/lms';
import { StaffAvatar } from '../../components/ui/StaffAvatar';
import { formatPlatformDate } from '../../utils/dateUtils';
import { getCourseDisplayName as defaultGetCourseDisplayName } from '../../utils/courseUtils';
import { MyAttendancePageHeader, useStudentCourseSelection } from './myAttendanceShared';

interface MyMinistryInfoViewProps {
  currentUser: User;
  courses: Course[];
  courseStudents: CourseStudent[];
  ministryTeams: MinistryTeam[];
  ministryRotations: MinistryRotation[];
  getCourseDisplayName?: (course: Course) => string;
  loading?: boolean;
}

function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-[#e5e5e5] bg-white ${className}`}>
      {children}
    </section>
  );
}

function ContactCard({
  name,
  avatarUrl,
  role,
  email,
  phone,
}: {
  name: string;
  avatarUrl: string | null;
  role: string;
  email?: string | null;
  phone?: string | null;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[#e5e5e5] bg-[#fafafa] p-3">
      <StaffAvatar name={name} avatarUrl={avatarUrl} role={role} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[#171717]">{name}</p>
        <p className="text-xs text-[#737373]">{role}</p>
        <div className="mt-2 space-y-1 text-xs text-[#525252]">
          {email ? (
            <a href={`mailto:${email}`} className="flex items-center gap-1.5 hover:text-[#2563eb]">
              <Mail className="h-3.5 w-3.5" />
              {email}
            </a>
          ) : null}
          {phone ? (
            <a href={`tel:${phone}`} className="flex items-center gap-1.5 hover:text-[#2563eb]">
              <Phone className="h-3.5 w-3.5" />
              {phone}
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function MyMinistryInfoView({
  currentUser,
  courses,
  courseStudents,
  ministryTeams,
  ministryRotations,
  getCourseDisplayName = defaultGetCourseDisplayName,
  loading,
}: MyMinistryInfoViewProps) {
  const { myCourses, selectedCourse, setSelectedCourseId, enrolledCourseIds } = useStudentCourseSelection(
    currentUser.id,
    courses,
    courseStudents
  );

  const assignments = useMemo(() => {
    const scopedCourseIds = selectedCourse
      ? enrolledCourseIds.filter(id => id === selectedCourse.id)
      : enrolledCourseIds;

    return ministryRotations
      .filter(rotation => rotation.studentId === currentUser.id && scopedCourseIds.includes(rotation.courseId))
      .map(rotation => {
        const course = courses.find(item => item.id === rotation.courseId);
        const team = ministryTeams.find(item => item.id === rotation.teamId);
        const contacts = (team?.members ?? []).filter(
          member => member.active && (member.role === 'leader' || member.role === 'assistant')
        );

        return {
          rotation,
          course,
          team,
          contacts,
        };
      })
      .filter(item => item.team)
      .sort((a, b) => a.rotation.startDate.localeCompare(b.rotation.startDate));
  }, [courses, currentUser.id, enrolledCourseIds, ministryRotations, ministryTeams, selectedCourse]);

  if (myCourses.length === 0) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-[#d4d4d4] bg-[#fafafa] px-6 py-16 text-center">
        <p className="text-sm font-medium text-[#171717]">No active course enrollment found.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <MyAttendancePageHeader title="Ministry" course={selectedCourse} courses={myCourses} onSelect={setSelectedCourseId} />
        <SectionCard className="p-8 text-center text-sm text-[#737373]">Loading ministry info…</SectionCard>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <MyAttendancePageHeader
        title="Ministry"
        course={selectedCourse}
        courses={myCourses}
        onSelect={setSelectedCourseId}
      />

      {assignments.length === 0 ? (
        <SectionCard className="p-8 text-center">
          <p className="text-sm font-medium text-[#171717]">No ministry assignment yet.</p>
          <p className="mt-1 text-sm text-[#737373]">
            When you are placed on a ministry team, your leaders and contact details will appear here.
          </p>
        </SectionCard>
      ) : (
        <div className="space-y-4">
          {assignments.map(({ rotation, course, team, contacts }) => (
            <SectionCard key={rotation.id} className="p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-lg font-semibold text-[#171717]">{team?.name}</p>
                  {course ? (
                    <p className="text-sm text-[#737373]">{getCourseDisplayName(course)}</p>
                  ) : null}
                  {team?.info ? <p className="mt-2 text-sm text-[#525252]">{team.info}</p> : null}
                </div>
                <div className="text-sm text-[#737373]">
                  <p>{formatPlatformDate(rotation.startDate)} – {formatPlatformDate(rotation.endDate)}</p>
                  <p className="mt-1 capitalize">{rotation.status}</p>
                </div>
              </div>

              <div className="mt-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">Team contacts</p>
                {contacts.length === 0 ? (
                  <p className="mt-2 text-sm text-[#737373]">No team leaders are listed for this ministry yet.</p>
                ) : (
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    {contacts.map(contact => (
                      <ContactCard
                        key={contact.id}
                        name={contact.userName}
                        avatarUrl={contact.userAvatarUrl}
                        role={contact.role === 'leader' ? 'Team leader' : 'Assistant leader'}
                        email={contact.userEmail}
                        phone={contact.userPhone}
                      />
                    ))}
                  </div>
                )}
              </div>
            </SectionCard>
          ))}
        </div>
      )}
    </div>
  );
}
