import { useCallback, useEffect, useState } from 'react';
import { translate } from '../i18n/translate';
import { supabase } from '../lib/supabase';
import type { GradeCategory, GradeSetting, GradingPeriod } from '../types/lms';

function mapCategory(row: any): GradeCategory {
  return {
    id: row.id,
    courseId: row.course_id,
    name: row.name,
    defaultPoints: row.default_points,
    weightPercent: row.weight_percent == null ? null : Number(row.weight_percent),
    color: row.color,
    sortOrder: row.sort_order,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPeriod(row: any): GradingPeriod {
  return {
    id: row.id,
    courseId: row.course_id,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSetting(row: any): GradeSetting {
  return {
    id: row.id,
    courseId: row.course_id,
    calculationMethod: row.calculation_method,
    showOverallGradeToStudents: row.show_overall_grade_to_students,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function useGradebookConfig() {
  const [categories, setCategories] = useState<GradeCategory[]>([]);
  const [periods, setPeriods] = useState<GradingPeriod[]>([]);
  const [settings, setSettings] = useState<GradeSetting[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [categoryResult, periodResult, settingResult] = await Promise.all([
        supabase.from('grade_categories').select('*').order('sort_order', { ascending: true }).order('name', { ascending: true }),
        supabase.from('grading_periods').select('*').order('start_date', { ascending: true }),
        supabase.from('grade_settings').select('*'),
      ]);

      if (categoryResult.error) throw categoryResult.error;
      if (periodResult.error) throw periodResult.error;
      if (settingResult.error) throw settingResult.error;

      setCategories((categoryResult.data ?? []).map(mapCategory));
      setPeriods((periodResult.data ?? []).map(mapPeriod));
      setSettings((settingResult.data ?? []).map(mapSetting));
    } catch (err) {
      setError(translate('errors.gradebook.loadFailed'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchConfig();
  }, [fetchConfig]);

  const saveCategory = async (data: Partial<GradeCategory> & { name: string; courseId?: number | null }) => {
    const payload = {
      course_id: data.courseId ?? null,
      name: data.name,
      default_points: data.defaultPoints ?? 100,
      weight_percent: data.weightPercent ?? null,
      color: data.color ?? '#1a73e8',
      sort_order: data.sortOrder ?? 0,
      active: data.active ?? true,
      updated_at: new Date().toISOString(),
    };
    const { error: saveError } = data.id
      ? await supabase.from('grade_categories').update(payload).eq('id', data.id)
      : await supabase.from('grade_categories').insert(payload);
    if (saveError) throw saveError;
    await fetchConfig();
  };

  const savePeriod = async (data: Partial<GradingPeriod> & { name: string; startDate: string; endDate: string; courseId?: number | null }) => {
    const payload = {
      course_id: data.courseId ?? null,
      name: data.name,
      start_date: data.startDate,
      end_date: data.endDate,
      active: data.active ?? true,
      updated_at: new Date().toISOString(),
    };
    const { error: saveError } = data.id
      ? await supabase.from('grading_periods').update(payload).eq('id', data.id)
      : await supabase.from('grading_periods').insert(payload);
    if (saveError) throw saveError;
    await fetchConfig();
  };

  const saveSetting = async (data: { courseId: number | null; calculationMethod: GradeSetting['calculationMethod']; showOverallGradeToStudents: boolean }) => {
    const { error: saveError } = await supabase.from('grade_settings').upsert({
      course_id: data.courseId,
      calculation_method: data.calculationMethod,
      show_overall_grade_to_students: data.showOverallGradeToStudents,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'course_id' });
    if (saveError) throw saveError;
    await fetchConfig();
  };

  return {
    categories,
    periods,
    settings,
    loading,
    error,
    saveCategory,
    savePeriod,
    saveSetting,
    refetch: fetchConfig,
  };
}
