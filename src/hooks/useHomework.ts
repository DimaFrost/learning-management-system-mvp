import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type {
  HomeworkAssignment,
  HomeworkSubmission,
  HomeworkComment,
  User,
  Course,
} from '../types/lms';
import {
  createAssignmentFolder,
} from '../utils/driveOperations';
import {
  uploadFileToStorage,
  buildStoragePath,
} from '../utils/storageOperations';
import { sendNotification } from '../utils/notifications';
import { findClassCourseContext } from '../utils/courseUtils';

type ShowConfirmation = (
  title: string,
  message: string,
  confirmText: string,
  onConfirm: () => void
) => void;

type SupabaseProfileJoin = { id: string; name: string } | null;

type SupabaseCommentRow = {
  id: number;
  submission_id: number;
  content: string;
  created_at: string;
  author: SupabaseProfileJoin;
};

function mapCommentRow(row: SupabaseCommentRow): HomeworkComment {
  return {
    id: row.id,
    submissionId: row.submission_id,
    authorId: row.author?.id ?? '',
    authorName: row.author?.name ?? 'Unknown',
    content: row.content,
    createdAt: row.created_at,
  };
}

export function useHomework(
  classId: number | null,
  currentUser: User,
  courses: Course[]
) {
  const [assignments, setAssignments] = useState<HomeworkAssignment[]>([]);
  const [submissions, setSubmissions] = useState<HomeworkSubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHomework = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    try {
      const { data: aData } = await supabase
        .from('homework_assignments')
        .select('*, author:profiles!author_id(id, name)')
        .eq('class_id', classId)
        .order('created_at', { ascending: false });

      setAssignments((aData ?? []).map(row => ({
        id: row.id,
        classId: row.class_id,
        authorId: row.author_id,
        authorName: row.author?.name ?? 'Unknown',
        title: row.title,
        description: row.description,
        dueDate: row.due_date,
        maxPoints: row.max_points,
        driveFolderId: row.drive_folder_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })));

      const assignmentIds = (aData ?? []).map(a => a.id);
      if (assignmentIds.length > 0) {
        const { data: sData } = await supabase
          .from('homework_submissions')
          .select(`
            *,
            student:profiles!student_id(id, name),
            comments:homework_comments(
              id, submission_id, content, created_at,
              author:profiles!author_id(id, name)
            )
          `)
          .in('assignment_id', assignmentIds)
          .order('created_at', { ascending: false });

        setSubmissions((sData ?? []).map(row => ({
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
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          comments: (row.comments ?? []).map((c: SupabaseCommentRow) =>
            mapCommentRow(c)
          ),
        })));
      } else {
        setSubmissions([]);
      }
    } catch (err) {
      setError('Failed to load homework');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => { fetchHomework(); }, [fetchHomework]);

  const createAssignment = async (data: {
    title: string;
    description: string | null;
    dueDate: string | null;
    maxPoints: number;
    classHomeworkFolderId: string | null;
  }) => {
    if (!classId) return;
    setSaving(true);
    try {
      const { data: inserted, error } = await supabase
        .from('homework_assignments')
        .insert({
          class_id: classId,
          author_id: currentUser.id,
          title: data.title,
          description: data.description,
          due_date: data.dueDate,
          max_points: data.maxPoints,
        })
        .select()
        .single();
      if (error) throw error;

      if (data.classHomeworkFolderId) {
        try {
          const folderId = await createAssignmentFolder(
            data.title, data.classHomeworkFolderId
          );
          await supabase
            .from('homework_assignments')
            .update({ drive_folder_id: folderId })
            .eq('id', inserted.id);
        } catch (driveErr) {
          console.error('Drive folder creation failed:', driveErr);
        }
      }

      try {
        const ctx = findClassCourseContext(classId, courses);
        const courseId = ctx?.course.id ?? null;
        const classInfo = ctx
          ? `${ctx.subject.title} — ${ctx.class.title}`
          : 'your session';

        let content = `A new homework assignment has been posted for ${classInfo}.`;
        if (data.dueDate) {
          content += ` Due: ${new Date(data.dueDate).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}.`;
        }
        if (data.description) {
          content += `\n\n${data.description}`;
        }

        const title = `New Homework: ${data.title}`;

        const { error: announcementError } = await supabase.from('announcements').insert({
          title,
          content,
          type: 'homework',
          author_id: currentUser.id,
          course_id: courseId,
          target_roles: ['student'],
          is_pinned: false,
          is_staff_only: false,
        });

        if (announcementError) throw announcementError;

        sendNotification('announcement', {
          title,
          content,
          authorName: currentUser.name,
          isStaffOnly: false,
        }).catch(console.error);
      } catch (announcementErr) {
        console.error('Homework announcement failed:', announcementErr);
      }

      await fetchHomework();
    } catch (err) {
      setError('Failed to create assignment');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const updateAssignment = async (
    id: number,
    updates: Partial<HomeworkAssignment>
  ) => {
    const { error } = await supabase
      .from('homework_assignments')
      .update({
        title: updates.title,
        description: updates.description,
        due_date: updates.dueDate,
        max_points: updates.maxPoints,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) { setError('Failed to update assignment'); return; }
    await fetchHomework();
  };

  const deleteAssignment = async (id: number, showConfirmation: ShowConfirmation) => {
    showConfirmation(
      'Delete Assignment',
      'This will delete the assignment and all student submissions. This cannot be undone.',
      'Delete',
      async () => {
        const { error } = await supabase
          .from('homework_assignments').delete().eq('id', id);
        if (error) { setError('Failed to delete'); return; }
        await fetchHomework();
      }
    );
  };

  const submitFile = async (params: {
    assignmentId: number;
    file: File;
    courseSlug: string;
    subjectSlug: string;
    classSlug: string;
  }) => {
    setSaving(true);
    setError(null);
    try {
      const storagePath = buildStoragePath({
        courseSlug: params.courseSlug,
        subjectSlug: params.subjectSlug,
        classSlug: params.classSlug,
        fileType: 'homework',
        fileName: params.file.name,
        studentName: currentUser.name,
      });

      const { storagePath: savedPath, publicUrl } =
        await uploadFileToStorage({ file: params.file, path: storagePath });

      await supabase.from('homework_submissions').upsert({
        assignment_id: params.assignmentId,
        student_id: currentUser.id,
        submission_type: 'file',
        drive_file_id: savedPath,
        drive_view_url: publicUrl,
        file_name: params.file.name,
        google_doc_id: null,
        google_doc_url: null,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'assignment_id,student_id' });

      await fetchHomework();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const linkGoogleDoc = async (params: {
    assignmentId: number;
    googleDocUrl: string;
  }) => {
    if (!params.googleDocUrl.includes('docs.google.com')) {
      setError('Please paste a valid Google Docs URL');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await supabase.from('homework_submissions').upsert({
        assignment_id: params.assignmentId,
        student_id: currentUser.id,
        submission_type: 'google_doc',
        google_doc_url: params.googleDocUrl,
        google_doc_id: null,
        status: 'draft',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'assignment_id,student_id' });
      await fetchHomework();
    } catch (err) {
      setError('Failed to link Google Doc. Please try again.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const submitGoogleDoc = async (submissionId: number) => {
    const { error } = await supabase
      .from('homework_submissions')
      .update({
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', submissionId);
    if (error) { setError('Failed to submit'); return; }
    await fetchHomework();
  };

  const gradeSubmission = async (params: {
    submissionId: number;
    points: number;
    gradeComment: string | null;
  }) => {
    setSaving(true);
    const { error } = await supabase
      .from('homework_submissions')
      .update({
        points: params.points,
        grade_comment: params.gradeComment,
        status: 'graded',
        graded_at: new Date().toISOString(),
        graded_by: currentUser.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.submissionId);
    setSaving(false);
    if (error) { setError('Failed to save grade'); return; }
    await fetchHomework();
  };

  const returnSubmission = async (submissionId: number) => {
    const { error } = await supabase
      .from('homework_submissions')
      .update({ status: 'returned', updated_at: new Date().toISOString() })
      .eq('id', submissionId);
    if (error) { setError('Failed to return submission'); return; }
    await fetchHomework();
  };

  const addComment = async (submissionId: number, content: string) => {
    const { error } = await supabase.from('homework_comments').insert({
      submission_id: submissionId,
      author_id: currentUser.id,
      content,
    });
    if (error) { setError('Failed to post comment'); return; }
    await fetchHomework();
  };

  const deleteComment = async (commentId: number) => {
    const { error } = await supabase
      .from('homework_comments').delete().eq('id', commentId);
    if (error) { setError('Failed to delete comment'); return; }
    await fetchHomework();
  };

  const getSubmission = (
    assignmentId: number,
    studentId: string
  ): HomeworkSubmission | undefined => {
    return submissions.find(
      s => s.assignmentId === assignmentId && s.studentId === studentId
    );
  };

  return {
    assignments, submissions, loading, saving, error,
    createAssignment, updateAssignment, deleteAssignment,
    submitFile, linkGoogleDoc, submitGoogleDoc,
    gradeSubmission, returnSubmission,
    addComment, deleteComment,
    getSubmission,
    refetch: fetchHomework,
  };
}
