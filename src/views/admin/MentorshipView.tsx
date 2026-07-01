import { useState } from 'react';
import { User as UserIcon, UserCheck } from 'lucide-react';
import type { User, Course, CourseStudent, MentorshipLog } from '../../types/lms';
import { MentorAssignModal } from '../../components/modals/MentorAssignModal';
import { PageHeader } from '../../components/ui/PageHeader';

interface MentorshipViewProps {
  users: User[];
  courseStudents: CourseStudent[];
  courses: Course[];
  mentorshipLogs: MentorshipLog[];
  getUserById: (id: string | null) => User | undefined;
  getCourseDisplayName: (course: Course) => string;
  onAssignMentor: (studentId: string, courseId: number, mentorId: string) => Promise<void>;
  onOpenCheckin: (studentId: string, existingLog?: MentorshipLog) => void;
}

export function MentorshipView({
  users,
  courseStudents,
  courses,
  mentorshipLogs,
  getUserById,
  getCourseDisplayName,
  onAssignMentor,
  onOpenCheckin,
}: MentorshipViewProps) {
  const [expandedPairs, setExpandedPairs] = useState<Set<string>>(new Set());
  const [editingPair, setEditingPair] = useState<{ studentId: string; mentorId: string | null; courseId?: number } | null>(null);

  const mentorshipPairs = courseStudents
    .filter(enrollment => enrollment.mentorId)
    .map(enrollment => {
    const student = getUserById(enrollment.studentId);
    const mentor = getUserById(enrollment.mentorId);
    const course = courses.find(c => c.id === enrollment.courseId);
    const studentLogs = mentorshipLogs.filter(log => log.studentId === enrollment.studentId);
    const latestLog = studentLogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

    return {
      ...enrollment,
      student,
      mentor,
      course,
      totalCheckins: studentLogs.length,
      latestCheckin: latestLog?.date,
      latestProgress: latestLog?.studentProgress,
      allLogs: studentLogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    };
  });

  const allStudents = users.filter(u => u.roles.includes('student'));
  const studentsWithoutMentors = allStudents.filter(student => {
    const enrollments = courseStudents.filter(cs => cs.studentId === student.id);
    if (enrollments.length === 0) return true;
    return !enrollments.some(cs => cs.mentorId);
  });

  const getEnrollmentForStudent = (studentId: string) =>
    courseStudents.find(cs => cs.studentId === studentId && !cs.mentorId)
    ?? courseStudents.find(cs => cs.studentId === studentId);

  const togglePairExpansion = (pairKey: string) => {
    const newExpanded = new Set(expandedPairs);
    if (newExpanded.has(pairKey)) {
      newExpanded.delete(pairKey);
    } else {
      newExpanded.add(pairKey);
    }
    setExpandedPairs(newExpanded);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mentorship Management"
        action={
          <div className="text-sm text-gray-600">
            {mentorshipPairs.length} active mentorship pairs
          </div>
        }
      />

      {studentsWithoutMentors.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-yellow-900 mb-4">
            Students Without Mentors ({studentsWithoutMentors.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {studentsWithoutMentors.map(student => (
              <div key={student.id} className="bg-white rounded-lg border border-yellow-200 p-4">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center">
                    <UserIcon className="w-4 h-4 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{student.name}</p>
                    <p className="text-xs text-gray-500">{student.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    const enrollment = getEnrollmentForStudent(student.id);
                    setEditingPair({
                      studentId: student.id,
                      mentorId: null,
                      courseId: enrollment?.courseId,
                    });
                  }}
                  className="w-full bg-yellow-600 text-white px-3 py-2 rounded text-sm hover:bg-yellow-700"
                >
                  Assign Mentor
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {mentorshipPairs.map(pair => {
          const pairKey = `${pair.studentId}-${pair.mentorId}`;
          const isExpanded = expandedPairs.has(pairKey);

          return (
            <div key={pairKey} className="bg-white rounded-lg shadow border border-gray-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Student-Mentor Pair</h3>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <UserIcon className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{pair.student?.name}</p>
                        <p className="text-xs text-gray-500">Student</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                        <UserCheck className="w-4 h-4 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{pair.mentor?.name}</p>
                        <p className="text-xs text-gray-500">Mentor</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                    pair.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {pair.status}
                  </span>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                  <div>
                    <p className="text-gray-500">Course</p>
                    <p className="font-medium text-gray-900">{pair.course ? getCourseDisplayName(pair.course) : 'Unknown Course'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Enrolled</p>
                    <p className="font-medium text-gray-900">{pair.enrollmentDate}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Total Check-ins</p>
                    <p className="font-medium text-gray-900">{pair.totalCheckins}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Latest Progress</p>
                    <div className="mt-1">
                      {pair.latestProgress ? (
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                          pair.latestProgress === 'excellent' ? 'bg-green-100 text-green-800' :
                          pair.latestProgress === 'good' ? 'bg-blue-100 text-blue-800' :
                          pair.latestProgress === 'needs_improvement' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {pair.latestProgress.replace('_', ' ')}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">No data</span>
                      )}
                    </div>
                  </div>
                </div>

                {pair.latestCheckin && (
                  <div className="mb-4 pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-500">Last Check-in: {pair.latestCheckin}</p>
                  </div>
                )}

                <div className="flex space-x-2 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => togglePairExpansion(pairKey)}
                    className="flex-1 bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700"
                  >
                    {isExpanded ? 'Hide' : 'View'} Check-ins ({pair.totalCheckins})
                  </button>
                  <button
                    onClick={() => setEditingPair({ studentId: pair.studentId, mentorId: pair.mentorId, courseId: pair.courseId })}
                    className="flex-1 bg-gray-600 text-white px-3 py-2 rounded text-sm hover:bg-gray-700"
                  >
                    Change Mentor
                  </button>
                </div>

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <h4 className="font-medium text-gray-900 mb-3">All Check-ins</h4>
                    {pair.allLogs.length > 0 ? (
                      <div className="space-y-3 max-h-64 overflow-y-auto">
                        {pair.allLogs.map(log => (
                          <div key={log.id} className="bg-gray-50 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-gray-900">
                                {log.type === 'digital' ? '💻 Digital' : '🤝 In-person'} Check-in
                              </span>
                              <span className="text-xs text-gray-500">{log.date}</span>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">{log.notes}</p>
                            {log.topics && log.topics.length > 0 && (
                              <div className="mb-2">
                                <span className="text-xs text-gray-500">Topics: </span>
                                <span className="text-xs text-gray-600">{log.topics.join(', ')}</span>
                              </div>
                            )}
                            {log.nextSteps && (
                              <div className="mb-2">
                                <span className="text-xs text-gray-500">Next Steps: </span>
                                <span className="text-xs text-gray-600">{log.nextSteps}</span>
                              </div>
                            )}
                            {log.duration && (
                              <div className="mb-2">
                                <span className="text-xs text-gray-500">Duration: </span>
                                <span className="text-xs text-gray-600">{log.duration} minutes</span>
                              </div>
                            )}
                            {log.studentProgress && (
                              <div className="mt-2">
                                <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                                  log.studentProgress === 'excellent' ? 'bg-green-100 text-green-800' :
                                  log.studentProgress === 'good' ? 'bg-blue-100 text-blue-800' :
                                  log.studentProgress === 'needs_improvement' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {log.studentProgress.replace('_', ' ')}
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">No check-ins recorded yet.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {mentorshipPairs.length === 0 && (
        <div className="text-center py-12">
          <UserCheck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No mentorship pairs found.</p>
        </div>
      )}

      <MentorAssignModal
        isOpen={!!editingPair}
        studentId={editingPair?.studentId ?? null}
        users={users}
        courseStudents={courseStudents}
        onClose={() => setEditingPair(null)}
        onAssign={async (studentId, mentorId) => {
          const courseId = editingPair?.courseId
            ?? getEnrollmentForStudent(studentId)?.courseId;
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
