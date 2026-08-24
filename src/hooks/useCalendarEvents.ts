import { useCallback, useEffect, useState } from 'react';
import { translate } from '../i18n/translate';
import { supabase } from '../lib/supabase';
import type { CalendarEventRecord, User } from '../types/lms';

type CalendarEventRow = {
  id: number;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  target_roles: string[] | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type CalendarEventInput = {
  title: string;
  description?: string | null;
  location?: string | null;
  startsAt: string;
  endsAt?: string | null;
  allDay: boolean;
  targetRoles: string[];
};

function mapCalendarEvent(row: CalendarEventRow): CalendarEventRecord {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    location: row.location,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    allDay: row.all_day,
    targetRoles: row.target_roles ?? [],
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function useCalendarEvents(currentUser: User) {
  const [events, setEvents] = useState<CalendarEventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canManageCalendarEvents = currentUser.roles.includes('administrator');

  const refetchCalendarEvents = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('calendar_events')
      .select('*')
      .order('starts_at', { ascending: true });

    if (fetchError) {
      setError(translate('errors.calendar.loadFailed'));
      console.error(fetchError);
      setLoading(false);
      return;
    }

    setEvents(((data ?? []) as CalendarEventRow[]).map(mapCalendarEvent));
    setLoading(false);
  }, []);

  useEffect(() => {
    void refetchCalendarEvents();
  }, [refetchCalendarEvents]);

  const createCalendarEvent = useCallback(async (input: CalendarEventInput) => {
    if (!canManageCalendarEvents) {
      throw new Error(translate('errors.calendar.adminOnly'));
    }

    const { error: insertError } = await supabase
      .from('calendar_events')
      .insert({
        title: input.title.trim(),
        description: input.description?.trim() || null,
        location: input.location?.trim() || null,
        starts_at: input.startsAt,
        ends_at: input.endsAt ?? null,
        all_day: input.allDay,
        target_roles: input.targetRoles,
        created_by: currentUser.id,
      });

    if (insertError) {
      setError(translate('errors.calendar.createFailed'));
      console.error(insertError);
      throw insertError;
    }

    await refetchCalendarEvents();
  }, [canManageCalendarEvents, currentUser.id, refetchCalendarEvents]);

  return {
    events,
    loading,
    error,
    canManageCalendarEvents,
    createCalendarEvent,
    refetchCalendarEvents,
  };
}
