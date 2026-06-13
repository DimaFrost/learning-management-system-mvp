import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export type CadenceSettings = {
  digital: {
    expectedDays: number;
    warningDays: number;
    criticalDays: number;
    label: string;
  };
  inPerson: {
    expectedDays: number;
    warningDays: number;
    criticalDays: number;
    label: string;
  };
};

const defaultCadenceSettings: CadenceSettings = {
  digital: {
    expectedDays: 7,
    warningDays: 10,
    criticalDays: 14,
    label: 'Digital Check-ins',
  },
  inPerson: {
    expectedDays: 30,
    warningDays: 35,
    criticalDays: 45,
    label: 'In-Person Check-ins',
  },
};

export function useCadenceSettings() {
  const [cadenceSettings, setCadenceSettingsState] = useState<CadenceSettings>(defaultCadenceSettings);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCadenceSettings() {
      setLoading(true);
      setError(null);
      try {
        const { data, error: fetchError } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'cadence')
          .single();

        if (fetchError) throw fetchError;

        setCadenceSettingsState(data.value as CadenceSettings);
      } catch (err) {
        console.error('fetchCadenceSettings error:', err);
        setError('Failed to load cadence settings');
      } finally {
        setLoading(false);
      }
    }

    fetchCadenceSettings();
  }, []);

  const setCadenceSettings = useCallback((newSettings: CadenceSettings) => {
    setCadenceSettingsState(newSettings);

    supabase
      .from('settings')
      .update({ value: newSettings, updated_at: new Date().toISOString() })
      .eq('key', 'cadence')
      .then(({ error: updateError }) => {
        if (updateError) {
          console.error('setCadenceSettings error:', updateError);
          setError('Failed to save cadence settings');
        }
      });
  }, []);

  return { cadenceSettings, setCadenceSettings, loading, error };
}
