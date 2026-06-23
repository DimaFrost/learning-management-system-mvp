import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { SubjectNote, User } from '../types/lms';

export function useSubjectCurriculumPlan(subjectId: number, currentUser: User) {
  const [plan, setPlan] = useState<SubjectNote | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchPlan = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('subject_notes')
        .select('*, author:profiles!author_id(id, name)')
        .eq('subject_id', subjectId)
        .eq('note_type', 'curriculum_plan')
        .maybeSingle();

      if (error) throw error;

      setPlan(
        data
          ? {
              id: data.id,
              subjectId: data.subject_id,
              authorId: data.author_id,
              authorName: data.author?.name ?? 'Unknown',
              noteType: data.note_type,
              title: data.title,
              content: data.content,
              createdAt: data.created_at,
              updatedAt: data.updated_at,
            }
          : null
      );
    } catch (err) {
      console.error('Failed to load curriculum plan:', err);
    } finally {
      setLoading(false);
    }
  }, [subjectId]);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  const saveCurriculumPlan = async (content: string) => {
    setSaving(true);
    try {
      if (plan) {
        const { error } = await supabase
          .from('subject_notes')
          .update({
            content,
            updated_at: new Date().toISOString(),
          })
          .eq('id', plan.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('subject_notes').insert({
          subject_id: subjectId,
          author_id: currentUser.id,
          note_type: 'curriculum_plan',
          title: null,
          content,
        });
        if (error) throw error;
      }
      await fetchPlan();
    } catch (err) {
      console.error('Failed to save curriculum plan:', err);
    } finally {
      setSaving(false);
    }
  };

  return { plan, loading, saving, saveCurriculumPlan };
}
