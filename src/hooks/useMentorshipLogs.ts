import { useState, useEffect, useCallback } from 'react';
import { translate } from '../i18n/translate';
import { supabase } from '../lib/supabase';
import type { MentorshipLog } from '../types/lms';
import { toLocalDateKey } from '../utils/dateUtils';

type MentorshipLogRow = {
  id: number;
  mentor_id: string | null;
  student_id: string;
  type: 'digital' | 'in_person';
  date: string;
  notes: string;
  duration: number | null;
  topics: string[] | null;
  next_steps: string | null;
  student_progress: MentorshipLog['studentProgress'] | null;
  meeting_month: string | null;
  in_person_meeting: MentorshipLog['inPersonMeeting'] | null;
  meetings_count: MentorshipLog['meetingsCount'] | null;
  stayed_in_touch: MentorshipLog['stayedInTouch'] | null;
  main_topic: string | null;
  engagement: MentorshipLog['engagement'] | null;
  challenges: string | null;
  school_support: string | null;
  positive_moment: string | null;
  other_observations: string | null;
};

function mapRowToMentorshipLog(row: MentorshipLogRow): MentorshipLog {
  return {
    id: row.id,
    mentorId: row.mentor_id ?? null,
    studentId: row.student_id,
    type: row.type,
    date: row.date,
    notes: row.notes,
    duration: row.duration ?? undefined,
    topics: row.topics ?? undefined,
    nextSteps: row.next_steps ?? undefined,
    studentProgress: row.student_progress ?? undefined,
    meetingMonth: row.meeting_month ?? undefined,
    inPersonMeeting: row.in_person_meeting ?? undefined,
    meetingsCount: row.meetings_count ?? undefined,
    stayedInTouch: row.stayed_in_touch ?? undefined,
    mainTopic: row.main_topic ?? undefined,
    engagement: row.engagement ?? undefined,
    challenges: row.challenges ?? undefined,
    schoolSupport: row.school_support ?? undefined,
    positiveMoment: row.positive_moment ?? undefined,
    otherObservations: row.other_observations ?? undefined,
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
  if (updates.meetingMonth !== undefined) row.meeting_month = updates.meetingMonth;
  if (updates.inPersonMeeting !== undefined) row.in_person_meeting = updates.inPersonMeeting;
  if (updates.meetingsCount !== undefined) row.meetings_count = updates.meetingsCount;
  if (updates.stayedInTouch !== undefined) row.stayed_in_touch = updates.stayedInTouch;
  if (updates.mainTopic !== undefined) row.main_topic = updates.mainTopic;
  if (updates.engagement !== undefined) row.engagement = updates.engagement;
  if (updates.challenges !== undefined) row.challenges = updates.challenges;
  if (updates.schoolSupport !== undefined) row.school_support = updates.schoolSupport;
  if (updates.positiveMoment !== undefined) row.positive_moment = updates.positiveMoment;
  if (updates.otherObservations !== undefined) row.other_observations = updates.otherObservations;
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
      setError(translate('errors.mentorship.loadFailed'));
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
      setError(translate('errors.mentorship.studentRequired'));
      return;
    }

    setError(null);
    try {
      const { error: insertError } = await supabase.from('mentorship_logs').insert({
        mentor_id: log.mentorId ?? defaultMentorId,
        student_id: log.studentId,
        type: log.type || 'digital',
        date: log.date || toLocalDateKey(),
        notes: log.notes || '',
        duration: log.duration ?? null,
        topics: log.topics || [],
        next_steps: log.nextSteps ?? null,
        student_progress: log.studentProgress ?? null,
        meeting_month: log.meetingMonth ?? null,
        in_person_meeting: log.inPersonMeeting ?? null,
        meetings_count: log.meetingsCount ?? null,
        stayed_in_touch: log.stayedInTouch ?? null,
        main_topic: log.mainTopic ?? null,
        engagement: log.engagement ?? null,
        challenges: log.challenges ?? null,
        school_support: log.schoolSupport ?? null,
        positive_moment: log.positiveMoment ?? null,
        other_observations: log.otherObservations ?? null,
      });

      if (insertError) throw insertError;

      await refetchMentorshipLogs();
    } catch (err) {
      setError(translate('errors.mentorship.addFailed'));
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
      setError(translate('errors.mentorship.updateFailed'));
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
      setError(translate('errors.mentorship.deleteFailed'));
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
