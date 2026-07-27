import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { HomeworkAssignment, HomeworkSubmission, SubmissionStatus } from '../types/lms';

type HomeworkAssignmentRow = {
  id: number;
  class_id: number | null;
  subject_id: number | null;
  author_id: string;
  author?: { id: string; name: string } | null;
  work_type: HomeworkAssignment['workType'] | null;
  question_type: HomeworkAssignment['questionType'];
  question_options: HomeworkAssignment['questionOptions'] | null;
  grade_category_id: number | null;
  grading_period_id: number | null;
  title: string;
  description: string | null;
  due_date: string | null;
  grading_due_date: string | null;
  max_points: number;
  drive_folder_id: string | null;
  created_at: string;
  updated_at: string;
};

type HomeworkSubmissionRow = {
  id: number;
  assignment_id: number;
  student_id: string;
  student?: { id: string; name: string } | null;
  submission_type: HomeworkSubmission['submissionType'];
  drive_file_id: string | null;
  drive_view_url: string | null;
  file_name: string | null;
  google_doc_id: string | null;
  google_doc_url: string | null;
  status: SubmissionStatus;
  submitted_at: string | null;
  points: number | null;
  grade_comment: string | null;
  graded_at: string | null;
  graded_by: string | null;
  response_text: string | null;
  selected_option: string | null;
  created_at: string;
  updated_at: string;
};

function mapAssignment(row: HomeworkAssignmentRow): HomeworkAssignment {
  return {
    id: row.id,
    classId: row.class_id,
    subjectId: row.subject_id,
    authorId: row.author_id,
    authorName: row.author?.name ?? 'Unknown',
    workType: row.work_type ?? 'assignment',
    questionType: row.question_type ?? null,
    questionOptions: Array.isArray(row.question_options) ? row.question_options : [],
    gradeCategoryId: row.grade_category_id,
    gradingPeriodId: row.grading_period_id,
    title: row.title,
    description: row.description,
    dueDate: row.due_date,
    gradingDueDate: row.grading_due_date,
    maxPoints: row.max_points,
    driveFolderId: row.drive_folder_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSubmission(row: HomeworkSubmissionRow): HomeworkSubmission {
  return {
    id: row.id,
    assignmentId: row.assignment_id,
    studentId: row.student_id,
    studentName: row.student?.name ?? 'Unknown',
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
    responseText: row.response_text,
    selectedOption: row.selected_option,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function useHomeworkSearch() {
  const [assignments, setAssignments] = useState<HomeworkAssignment[]>([]);
  const [submissions, setSubmissions] = useState<HomeworkSubmission[]>([]);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const [assignmentsResult, submissionsResult] = await Promise.all([
        supabase
          .from('homework_assignments')
          .select('*, author:profiles!author_id(id, name)')
          .order('created_at', { ascending: false }),
        supabase
          .from('homework_submissions')
          .select('*, student:profiles!student_id(id, name)')
          .order('updated_at', { ascending: false }),
      ]);

      if (assignmentsResult.error) throw assignmentsResult.error;
      if (submissionsResult.error) throw submissionsResult.error;

      setAssignments(((assignmentsResult.data ?? []) as HomeworkAssignmentRow[]).map(mapAssignment));
      setSubmissions(((submissionsResult.data ?? []) as HomeworkSubmissionRow[]).map(mapSubmission));
    } catch (error) {
      console.error('Failed to load homework search data', error);
      setAssignments([]);
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { assignments, submissions, loading, refetch };
}
