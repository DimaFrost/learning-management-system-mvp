import { useState, useRef, useMemo } from 'react';
import {
  Plus,
  Pencil,
  Trash,
  ChevronDown,
  ExternalLink,
} from 'lucide-react';
import type {
  HomeworkAssignment,
  HomeworkSubmission,
  CourseStudent,
  SubmissionStatus,
  User,
  Course,
  Subject,
  Class,
} from '../../../types/lms';
import { hasRole } from '../../../utils/userUtils';
import { getCourseDisplayName } from '../../../utils/courseUtils';
import { formatDueDate } from '../../../utils/dateUtils';
import { CreateAssignmentModal } from '../../../components/modals/CreateAssignmentModal';
import { GradeModal } from '../../../components/modals/GradeModal';
import { SubmissionDetailModal } from '../../../components/modals/SubmissionDetailModal';

type ShowConfirmation = (
  title: string,
  message: string,
  confirmText: string,
  onConfirm: () => void
) => void;

interface HomeworkTabProps {
  assignments: HomeworkAssignment[];
  submissions: HomeworkSubmission[];
  currentUser: User;
  users: User[];
  courseStudents: CourseStudent[];
  courseId: number;
  classId: number;
  saving: boolean;
  onCreateAssignment: (data: {
    title: string;
    description: string | null;
    dueDate: string | null;
    maxPoints: number;
  }) => Promise<void>;
  onUpdateAssignment: (
    id: number,
    updates: Partial<HomeworkAssignment>
  ) => Promise<void>;
  onDeleteAssignment: (id: number) => void;
  onSubmitFile: (params: {
    assignmentId: number;
    file: File;
    courseSlug: string;
    subjectSlug: string;
    classSlug: string;
  }) => Promise<void>;
  onLinkGoogleDoc: (params: {
    assignmentId: number;
    googleDocUrl: string;
  }) => Promise<void>;
  onSubmitGoogleDoc: (submissionId: number) => Promise<void>;
  onGrade: (params: {
    submissionId: number;
    points: number;
    gradeComment: string | null;
  }) => Promise<void>;
  onReturn: (submissionId: number) => Promise<void>;
  onAddComment: (submissionId: number, content: string) => Promise<void>;
  onDeleteComment: (commentId: number) => Promise<void>;
  getSubmission: (
    assignmentId: number,
    studentId: string
  ) => HomeworkSubmission | undefined;
  showConfirmation: ShowConfirmation;
  selectedCourse: Course;
  selectedSubject: Subject;
  selectedClass: Class;
}

function formatSubmittedDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function getSubmissionUrl(submission: HomeworkSubmission): string | null {
  return submission.driveViewUrl ?? submission.googleDocUrl;
}

function isSubmittedStatus(status: SubmissionStatus): boolean {
  return status === 'submitted' || status === 'graded' || status === 'returned';
}

function SubmissionStatusBadge({
  status,
  maxPoints,
  points,
}: {
  status: SubmissionStatus;
  maxPoints?: number;
  points?: number | null;
}) {
  const configs: Record<SubmissionStatus, { label: string; className: string }> = {
    not_started: { label: 'Not started', className: 'bg-gray-100 text-gray-600' },
    draft: { label: 'In progress', className: 'bg-blue-100 text-blue-800' },
    submitted: { label: 'Submitted', className: 'bg-amber-100 text-amber-800' },
    graded: {
      label: `Graded (${points ?? 0}/${maxPoints ?? 100})`,
      className: 'bg-green-100 text-green-800',
    },
    returned: { label: 'Returned', className: 'bg-orange-100 text-orange-800' },
  };
  const config = configs[status];
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}

function SubmissionComments({
  submission,
  currentUser,
  saving,
  onAddComment,
  onDeleteComment,
}: {
  submission: HomeworkSubmission;
  currentUser: User;
  saving: boolean;
  onAddComment: (submissionId: number, content: string) => Promise<void>;
  onDeleteComment: (commentId: number) => Promise<void>;
}) {
  const [draft, setDraft] = useState('');
  const isAdmin = hasRole(currentUser, 'administrator');
  const comments = submission.comments ?? [];

  const handlePost = async () => {
    const content = draft.trim();
    if (!content) return;
    await onAddComment(submission.id, content);
    setDraft('');
  };

  return (
    <div className="border-t border-gray-100 pt-4 mt-4">
      <h4 className="text-sm font-medium text-gray-900 mb-3">Comments</h4>
      {comments.length === 0 ? (
        <p className="text-sm text-gray-500 mb-3">No comments yet.</p>
      ) : (
        <div className="space-y-2 mb-3">
          {comments.map(c => (
            <div key={c.id} className="p-3 rounded-lg bg-gray-50 text-sm">
              <p className="text-gray-800 whitespace-pre-wrap">{c.content}</p>
              <div className="flex justify-between items-center mt-1">
                <span className="text-xs text-gray-500">
                  {c.authorName} · {formatSubmittedDate(c.createdAt)}
                </span>
                {(isAdmin || c.authorId === currentUser.id) && (
                  <button
                    type="button"
                    onClick={() => onDeleteComment(c.id)}
                    disabled={saving}
                    className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          rows={2}
          placeholder="Add a comment..."
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500"
        />
        <button
          type="button"
          onClick={handlePost}
          disabled={saving || !draft.trim()}
          className="self-end px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50"
        >
          Post
        </button>
      </div>
    </div>
  );
}

function StudentAssignmentCard({
  assignment,
  submission,
  saving,
  courseSlug,
  subjectSlug,
  classSlug,
  onSubmitFile,
  onLinkGoogleDoc,
  onSubmitGoogleDoc,
  onAddComment,
  onDeleteComment,
  currentUser,
}: {
  assignment: HomeworkAssignment;
  submission: HomeworkSubmission | undefined;
  saving: boolean;
  courseSlug: string;
  subjectSlug: string;
  classSlug: string;
  onSubmitFile: HomeworkTabProps['onSubmitFile'];
  onLinkGoogleDoc: HomeworkTabProps['onLinkGoogleDoc'];
  onSubmitGoogleDoc: HomeworkTabProps['onSubmitGoogleDoc'];
  onAddComment: HomeworkTabProps['onAddComment'];
  onDeleteComment: HomeworkTabProps['onDeleteComment'];
  currentUser: User;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [googleDocUrl, setGoogleDocUrl] = useState('');
  const status: SubmissionStatus = submission?.status ?? 'not_started';

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await onSubmitFile({
      assignmentId: assignment.id,
      file,
      courseSlug,
      subjectSlug,
      classSlug,
    });
    e.target.value = '';
  };

  const handleLinkDoc = async () => {
    const url = googleDocUrl.trim();
    if (!url) return;
    await onLinkGoogleDoc({
      assignmentId: assignment.id,
      googleDocUrl: url,
    });
    setGoogleDocUrl('');
  };

  const linkDocSection = (
    <div className="space-y-2">
      <p className="text-sm text-gray-600">
        Create a Google Doc in your own Google Drive, then paste the link here.
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          type="url"
          value={googleDocUrl}
          onChange={e => setGoogleDocUrl(e.target.value)}
          placeholder="https://docs.google.com/document/d/..."
          className="flex-1 min-w-[200px] rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
        <button
          type="button"
          onClick={handleLinkDoc}
          disabled={saving || !googleDocUrl.trim()}
          className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          Link Document
        </button>
      </div>
    </div>
  );

  const openSubmission = () => {
    const url = submission && getSubmissionUrl(submission);
    if (url) window.open(url, '_blank');
  };

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{assignment.title}</h3>
          <p className="text-sm text-gray-500 mt-1">
            Due: {formatDueDate(assignment.dueDate)}
          </p>
        </div>
        <SubmissionStatusBadge
          status={status}
          maxPoints={assignment.maxPoints}
          points={submission?.points}
        />
      </div>

      {assignment.description && (
        <p className="text-gray-700 whitespace-pre-wrap">{assignment.description}</p>
      )}

      {status === 'not_started' && (
        <div className="space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Upload File
            </button>
          </div>
          {linkDocSection}
        </div>
      )}

      {status === 'draft' && submission && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Your document has been linked. Click Submit when you are ready.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() =>
                submission.googleDocUrl && window.open(submission.googleDocUrl, '_blank')
              }
              className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Continue Working
            </button>
            <button
              type="button"
              onClick={() => onSubmitGoogleDoc(submission.id)}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50"
            >
              Submit
            </button>
          </div>
        </div>
      )}

      {status === 'submitted' && submission && (
        <>
          <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800">
            Submitted on{' '}
            {submission.submittedAt
              ? formatSubmittedDate(submission.submittedAt)
              : '—'}
          </div>
          <button
            type="button"
            onClick={openSubmission}
            className="flex items-center gap-1.5 text-sm text-amber-700 hover:text-amber-900 font-medium"
          >
            <ExternalLink className="w-4 h-4" />
            View your submission
          </button>
          <SubmissionComments
            submission={submission}
            currentUser={currentUser}
            saving={saving}
            onAddComment={onAddComment}
            onDeleteComment={onDeleteComment}
          />
        </>
      )}

      {status === 'graded' && submission && (
        <>
          <div className="p-4 rounded-lg bg-green-50 border border-green-200">
            <p className="text-3xl font-bold text-green-800">
              {submission.points ?? 0} / {assignment.maxPoints}
            </p>
            {submission.gradeComment && (
              <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">
                {submission.gradeComment}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={openSubmission}
            className="flex items-center gap-1.5 text-sm text-amber-700 hover:text-amber-900 font-medium"
          >
            <ExternalLink className="w-4 h-4" />
            View Submission
          </button>
          <SubmissionComments
            submission={submission}
            currentUser={currentUser}
            saving={saving}
            onAddComment={onAddComment}
            onDeleteComment={onDeleteComment}
          />
        </>
      )}

      {status === 'returned' && submission && (
        <>
          <div className="p-4 rounded-lg bg-orange-50 border border-orange-200 text-sm text-orange-800">
            Your submission has been returned for revision
            {submission.gradeComment && (
              <p className="mt-2 text-gray-700 whitespace-pre-wrap">
                {submission.gradeComment}
              </p>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Upload File
            </button>
          </div>
          {linkDocSection}
        </>
      )}
    </div>
  );
}

export function HomeworkTab({
  assignments,
  currentUser,
  users,
  courseStudents,
  courseId,
  saving,
  onCreateAssignment,
  onUpdateAssignment,
  onDeleteAssignment,
  onSubmitFile,
  onLinkGoogleDoc,
  onSubmitGoogleDoc,
  onGrade,
  onReturn,
  onAddComment,
  onDeleteComment,
  getSubmission,
  selectedCourse,
  selectedSubject,
  selectedClass,
}: HomeworkTabProps) {
  const isTeacherOrAdmin =
    hasRole(currentUser, 'administrator') || hasRole(currentUser, 'teacher');
  const isAdmin = hasRole(currentUser, 'administrator');

  const courseSlug = getCourseDisplayName(selectedCourse)
    .toLowerCase().replace(/\s+/g, '-');
  const subjectSlug = selectedSubject.title
    .toLowerCase().replace(/\s+/g, '-');
  const classSlug = `${selectedClass.date ?? 'no-date'}-${selectedClass.title.toLowerCase().replace(/\s+/g, '-')}`;

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] =
    useState<HomeworkAssignment | null>(null);
  const [expandedAssignments, setExpandedAssignments] = useState<Set<number>>(
    new Set()
  );
  const [gradingSubmission, setGradingSubmission] =
    useState<HomeworkSubmission | null>(null);
  const [gradingAssignment, setGradingAssignment] =
    useState<HomeworkAssignment | null>(null);
  const [detailSubmission, setDetailSubmission] =
    useState<HomeworkSubmission | null>(null);
  const [detailAssignment, setDetailAssignment] =
    useState<HomeworkAssignment | null>(null);

  const enrolledStudents = useMemo(
    () =>
      courseStudents
        .filter(cs => cs.courseId === courseId && cs.status === 'active')
        .map(cs => users.find(u => u.id === cs.studentId))
        .filter((u): u is User => !!u),
    [courseStudents, courseId, users]
  );

  const toggleExpanded = (assignmentId: number) => {
    setExpandedAssignments(prev => {
      const next = new Set(prev);
      if (next.has(assignmentId)) next.delete(assignmentId);
      else next.add(assignmentId);
      return next;
    });
  };

  const countSubmitted = (assignmentId: number) =>
    enrolledStudents.filter(s => {
      const sub = getSubmission(assignmentId, s.id);
      return sub && isSubmittedStatus(sub.status);
    }).length;

  const handleCreateOrUpdate = async (data: {
    title: string;
    description: string | null;
    dueDate: string | null;
    maxPoints: number;
  }) => {
    if (editingAssignment) {
      await onUpdateAssignment(editingAssignment.id, data);
      setEditingAssignment(null);
    } else {
      await onCreateAssignment(data);
    }
  };

  const openGradeModal = (
    submission: HomeworkSubmission,
    assignment: HomeworkAssignment
  ) => {
    setGradingSubmission(submission);
    setGradingAssignment(assignment);
    setDetailSubmission(null);
  };

  const openDetailModal = (
    submission: HomeworkSubmission,
    assignment: HomeworkAssignment
  ) => {
    setDetailSubmission(submission);
    setDetailAssignment(assignment);
  };

  if (isTeacherOrAdmin) {
    return (
      <div className="space-y-6">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              setEditingAssignment(null);
              setCreateModalOpen(true);
            }}
            disabled={saving}
            className="flex items-center gap-1.5 bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Post Assignment
          </button>
        </div>

        {assignments.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">
            No assignments posted yet.
          </p>
        ) : (
          assignments.map(assignment => {
            const submittedCount = countSubmitted(assignment.id);
            const totalStudents = enrolledStudents.length;
            const progress =
              totalStudents > 0 ? (submittedCount / totalStudents) * 100 : 0;
            const isExpanded = expandedAssignments.has(assignment.id);
            const canManageAssignment =
              isAdmin || assignment.authorId === currentUser.id;

            return (
              <div
                key={assignment.id}
                className="bg-white rounded-lg shadow border border-gray-200 p-6 space-y-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {assignment.title}
                    </h3>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800">
                      Due: {formatDueDate(assignment.dueDate)}
                    </span>
                  </div>
                  {canManageAssignment && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingAssignment(assignment);
                          setCreateModalOpen(true);
                        }}
                        disabled={saving}
                        className="p-1.5 text-gray-400 hover:text-amber-600 rounded-md hover:bg-gray-100"
                        aria-label="Edit assignment"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteAssignment(assignment.id)}
                        disabled={saving}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded-md hover:bg-gray-100"
                        aria-label="Delete assignment"
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {assignment.description && (
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {assignment.description}
                  </p>
                )}

                <div>
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>
                      {submittedCount} / {totalStudents} students submitted
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-600 rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => toggleExpanded(assignment.id)}
                  className="flex items-center gap-2 text-sm font-medium text-amber-700 hover:text-amber-900"
                >
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  />
                  Student Submissions
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100 pt-4 space-y-2">
                    {enrolledStudents.length === 0 ? (
                      <p className="text-sm text-gray-500">No enrolled students.</p>
                    ) : (
                      enrolledStudents.map(student => {
                        const sub = getSubmission(assignment.id, student.id);
                        const status: SubmissionStatus = sub?.status ?? 'not_started';

                        return (
                          <div
                            key={student.id}
                            className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-gray-100"
                          >
                            <span className="text-sm font-medium text-gray-900">
                              {student.name}
                            </span>
                            <div className="flex flex-wrap items-center gap-2">
                              <SubmissionStatusBadge
                                status={status}
                                maxPoints={assignment.maxPoints}
                                points={sub?.points}
                              />
                              {sub && isSubmittedStatus(status) && (
                                <button
                                  type="button"
                                  onClick={() => openDetailModal(sub, assignment)}
                                  className="text-sm text-amber-700 hover:text-amber-900 font-medium"
                                >
                                  View submission
                                </button>
                              )}
                              {sub && status === 'submitted' && (
                                <button
                                  type="button"
                                  onClick={() => openGradeModal(sub, assignment)}
                                  disabled={saving}
                                  className="px-3 py-1 text-sm font-medium text-white bg-amber-600 rounded-md hover:bg-amber-700 disabled:opacity-50"
                                >
                                  Grade
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}

        <CreateAssignmentModal
          isOpen={createModalOpen}
          editingAssignment={editingAssignment}
          onClose={() => {
            setCreateModalOpen(false);
            setEditingAssignment(null);
          }}
          onSubmit={handleCreateOrUpdate}
        />

        <GradeModal
          submission={gradingSubmission}
          assignment={gradingAssignment}
          onClose={() => {
            setGradingSubmission(null);
            setGradingAssignment(null);
          }}
          onGrade={onGrade}
          onReturn={onReturn}
        />

        <SubmissionDetailModal
          isOpen={detailSubmission !== null}
          submission={detailSubmission}
          assignment={detailAssignment}
          currentUser={currentUser}
          isTeacherOrAdmin={isTeacherOrAdmin}
          onClose={() => {
            setDetailSubmission(null);
            setDetailAssignment(null);
          }}
          onGrade={
            detailSubmission?.status === 'submitted' && detailAssignment
              ? () => openGradeModal(detailSubmission, detailAssignment)
              : undefined
          }
          onReturn={onReturn}
          onAddComment={onAddComment}
          onDeleteComment={onDeleteComment}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {assignments.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-8">
          No homework assignments yet.
        </p>
      ) : (
        assignments.map(assignment => (
          <StudentAssignmentCard
            key={assignment.id}
            assignment={assignment}
            submission={getSubmission(assignment.id, currentUser.id)}
            saving={saving}
            courseSlug={courseSlug}
            subjectSlug={subjectSlug}
            classSlug={classSlug}
            onSubmitFile={onSubmitFile}
            onLinkGoogleDoc={onLinkGoogleDoc}
            onSubmitGoogleDoc={onSubmitGoogleDoc}
            onAddComment={onAddComment}
            onDeleteComment={onDeleteComment}
            currentUser={currentUser}
          />
        ))
      )}
    </div>
  );
}
