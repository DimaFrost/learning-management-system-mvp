import type { PlanningRow } from '../hooks/useSchoolYearPlanning';

const SELECTED_YEAR_KEY = 'tbo-planning-selected-year';

function draftKey(label: string): string {
  return `tbo-planning-draft:${label}`;
}

export interface PlanningDraftCacheEntry {
  rows: PlanningRow[];
  firstYearCourseId: number | null;
  secondYearCourseId: number | null;
  isDirty: boolean;
}

export function readSelectedYear(): string | null {
  try {
    return sessionStorage.getItem(SELECTED_YEAR_KEY);
  } catch {
    return null;
  }
}

export function writeSelectedYear(label: string | null): void {
  try {
    if (label) {
      sessionStorage.setItem(SELECTED_YEAR_KEY, label);
    } else {
      sessionStorage.removeItem(SELECTED_YEAR_KEY);
    }
  } catch {
    // ignore storage failures
  }
}

export function readDraft(label: string): PlanningDraftCacheEntry | null {
  try {
    const raw = sessionStorage.getItem(draftKey(label));
    if (!raw) return null;
    return JSON.parse(raw) as PlanningDraftCacheEntry;
  } catch {
    clearDraft(label);
    return null;
  }
}

export function writeDraft(label: string, entry: PlanningDraftCacheEntry): void {
  try {
    sessionStorage.setItem(draftKey(label), JSON.stringify(entry));
  } catch {
    // ignore storage failures
  }
}

export function clearDraft(label: string): void {
  try {
    sessionStorage.removeItem(draftKey(label));
  } catch {
    // ignore storage failures
  }
}
