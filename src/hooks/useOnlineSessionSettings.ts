import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export type OnlineSessionSettings = {
  meetLink: string;
};

const defaultOnlineSessionSettings: OnlineSessionSettings = {
  meetLink: '',
};

export function useOnlineSessionSettings() {
  const [onlineSessionSettings, setOnlineSessionSettingsState] =
    useState<OnlineSessionSettings>(defaultOnlineSessionSettings);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOnlineSessionSettings() {
      setLoading(true);
      setError(null);
      try {
        const { data, error: fetchError } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'online_session')
          .single();

        if (fetchError) throw fetchError;

        setOnlineSessionSettingsState({
          ...defaultOnlineSessionSettings,
          ...(data.value as Partial<OnlineSessionSettings>),
        });
      } catch (err) {
        console.error('fetchOnlineSessionSettings error:', err);
        setError('Failed to load online session settings');
      } finally {
        setLoading(false);
      }
    }

    fetchOnlineSessionSettings();
  }, []);

  const setOnlineSessionSettings = useCallback((newSettings: OnlineSessionSettings) => {
    setOnlineSessionSettingsState(newSettings);

    supabase
      .from('settings')
      .update({ value: newSettings, updated_at: new Date().toISOString() })
      .eq('key', 'online_session')
      .then(({ error: updateError }) => {
        if (updateError) {
          console.error('setOnlineSessionSettings error:', updateError);
          setError('Failed to save online session settings');
        }
      });
  }, []);

  return { onlineSessionSettings, setOnlineSessionSettings, loading, error };
}
