import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { SubjectNote, User } from '../types/lms';

function mapSubjectNoteRow(data: Record<string, unknown>): SubjectNote {
  const author = data.author as { name?: string } | null;
  return {
    id: data.id as number,
    subjectId: data.subject_id as number,
    authorId: data.author_id as string,
    authorName: author?.name ?? 'Unknown',
    noteType: data.note_type as SubjectNote['noteType'],
    title: (data.title as string | null) ?? null,
    content: (data.content as string | null) ?? null,
    storagePath: (data.storage_path as string | null) ?? null,
    publicUrl: (data.public_url as string | null) ?? null,
    fileName: (data.file_name as string | null) ?? null,
    fileSize: (data.file_size as number | null) ?? null,
    mimeType: (data.mime_type as string | null) ?? null,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  };
}

export function hasCurriculumPlanFile(plan: SubjectNote | null): boolean {
  return !!(plan?.storagePath && plan?.publicUrl && plan?.fileName);
}

export function hasLegacyCurriculumText(plan: SubjectNote | null): boolean {
  return !!(plan?.content && !plan?.storagePath);
}

export function useSubjectCurriculumPlan(subjectId: number, currentUser: User) {
  const [plan, setPlan] = useState<SubjectNote | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPlan = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('subject_notes')
        .select('*, author:profiles!author_id(id, name)')
        .eq('subject_id', subjectId)
        .eq('note_type', 'curriculum_plan')
        .maybeSingle();

      if (fetchError) throw fetchError;

      setPlan(data ? mapSubjectNoteRow(data) : null);
    } catch (err) {
      console.error('Failed to load curriculum plan:', err);
    } finally {
      setLoading(false);
    }
  }, [subjectId]);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  const uploadCurriculumPlan = async (file: File) => {
    if (!subjectId) return;
    setSaving(true);
    setError(null);
    try {
      const path = `subjects/${subjectId}/curriculum-plan/${file.name}`;

      if (plan?.storagePath && plan.storagePath !== path) {
        await supabase.storage.from('tbo-lms').remove([plan.storagePath]);
      }

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('tbo-lms')
        .upload(path, file, {
          upsert: true,
          cacheControl: '3600',
        });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('tbo-lms')
        .getPublicUrl(uploadData.path);

      const fileFields = {
        content: null,
        storage_path: uploadData.path,
        public_url: urlData.publicUrl,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type || null,
        updated_at: new Date().toISOString(),
      };

      if (plan) {
        const { error: updateError } = await supabase
          .from('subject_notes')
          .update(fileFields)
          .eq('id', plan.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from('subject_notes').insert({
          subject_id: subjectId,
          author_id: currentUser.id,
          note_type: 'curriculum_plan',
          title: null,
          ...fileFields,
        });
        if (insertError) throw insertError;
      }

      await fetchPlan();
    } catch (err) {
      setError('Failed to upload curriculum plan.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const deleteCurriculumPlan = async () => {
    if (!plan) return;
    setSaving(true);
    setError(null);
    try {
      if (plan.storagePath) {
        await supabase.storage.from('tbo-lms').remove([plan.storagePath]);
      }
      const { error: deleteError } = await supabase
        .from('subject_notes')
        .delete()
        .eq('id', plan.id);
      if (deleteError) throw deleteError;
      await fetchPlan();
    } catch (err) {
      setError('Failed to remove curriculum plan.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return {
    plan,
    loading,
    saving,
    error,
    uploadCurriculumPlan,
    deleteCurriculumPlan,
    refetch: fetchPlan,
  };
}
