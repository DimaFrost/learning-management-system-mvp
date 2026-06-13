import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { MentorshipLog } from '../types/lms';

type MentorshipLogRow = {
  id: number;
  mentor_id: string;
  student_id: string;
  type: 'digital' | 'in_person';
  date: string;
  notes: string;
  duration: number | null;
  topics: string[] | null;
  next_steps: string | null;
  student_progress: MentorshipLog['studentProgress'] | null;
};

function mapRowToMentorshipLog(row: MentorshipLogRow): MentorshipLog {
  return {
    id: row.id,
    mentorId: row.mentor_id,
    studentId: row.student_id,
    type: row.type,
    date: row.date,
    notes: row.notes,
    duration: row.duration ?? undefined,
    topics: row.topics ?? undefined,
    nextSteps: row.next_steps ?? undefined,
    studentProgress: row.student_progress ?? undefined,
  };
}

function mapUpdatesToRow(updates: Partial<MentorshipLog>) {
  const row: Record<string, unknown> = {};
  if (updates.mentorId !== undefined) row.mentor_id = updates.mentorId;
  if (updates.studentId !== undefined) row.student_id = updates.studentId;
  if (updates.type !== undefined) row.type = updates.type;
  if (updates.date !== undefined) row.date = updates.date;
  if (updates.notes !== undefined) row.notes = updates.notes;
  if (updates.duration !== undefined) row.duration = updates.duration;
  if (updates.topics !== undefined) row.topics = updates.topics;
  if (updates.nextSteps !== undefined) row.next_steps = updates.nextSteps;
  if (updates.studentProgress !== undefined) row.student_progress = updates.studentProgress;
  return row;
}

export function useMentorshipLogs() {
  const [mentorshipLogs, setMentorshipLogs] = useState<MentorshipLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetchMentorshipLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('mentorship_logs')
        .select('*')
        .order('date', { ascending: false });

      if (fetchError) throw fetchError;

      setMentorshipLogs((data ?? []).map(row => mapRowToMentorshipLog(row as MentorshipLogRow)));
    } catch (err) {
      setError('Failed to load mentorship logs');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetchMentorshipLogs();
  }, [refetchMentorshipLogs]);

  const addMentorshipLog = useCallback(async (log: Partial<MentorshipLog>, defaultMentorId: string) => {
    if (!log.studentId) {
      setError('Student is required for mentorship log');
      return;
    }

    setError(null);
    try {
      const { error: insertError } = await supabase.from('mentorship_logs').insert({
        mentor_id: log.mentorId || defaultMentorId,
        student_id: log.studentId,
        type: log.type || 'digital',
        date: log.date || new Date().toISOString().split('T')[0],
        notes: log.notes || '',
        duration: log.duration,
        topics: log.topics || [],
        next_steps: log.nextSteps,
        student_progress: log.studentProgress,
      });

      if (insertError) throw insertError;

      await refetchMentorshipLogs();
    } catch (err) {
      setError('Failed to add mentorship log');
      console.error(err);
    }
  }, [refetchMentorshipLogs]);

  const updateMentorshipLog = useCallback(async (id: number, updates: Partial<MentorshipLog>) => {
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('mentorship_logs')
        .update(mapUpdatesToRow(updates))
        .eq('id', id);

      if (updateError) throw updateError;

      await refetchMentorshipLogs();
    } catch (err) {
      setError('Failed to update mentorship log');
      console.error(err);
    }
  }, [refetchMentorshipLogs]);

  const deleteMentorshipLog = useCallback(async (id: number) => {
    setError(null);
    try {
      const { error: deleteError } = await supabase
        .from('mentorship_logs')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      await refetchMentorshipLogs();
    } catch (err) {
      setError('Failed to delete mentorship log');
      console.error(err);
    }
  }, [refetchMentorshipLogs]);

  return {
    mentorshipLogs,
    loading,
    error,
    addMentorshipLog,
    updateMentorshipLog,
    deleteMentorshipLog,
  };
}
