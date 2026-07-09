import { useCallback, useEffect, useMemo, useState } from 'react';
import { Minus, Plus, Save, Users } from 'lucide-react';
import type { CadenceSettings } from '../../hooks/useCadenceSettings';
import { SectionCard } from './mentorshipShared';

interface MentorshipCadencePanelProps {
  cadenceSettings: CadenceSettings;
  setCadenceSettings: (settings: CadenceSettings) => void;
}

type CadenceField = 'expectedDays' | 'warningDays' | 'criticalDays';

const fieldMeta: Array<{ field: CadenceField; label: string; hint: string }> = [
  { field: 'expectedDays', label: 'Expected interval', hint: 'Ideal days between in-person meetings' },
  { field: 'warningDays', label: 'Warning threshold', hint: 'Shows as lagging after this many days' },
  { field: 'criticalDays', label: 'Critical threshold', hint: 'Shows as at risk after this many days' },
];

function ThresholdPreview({
  expected,
  warning,
  critical,
}: {
  expected: number;
  warning: number;
  critical: number;
}) {
  const max = Math.max(critical, warning, expected, 1);
  const segments = [
    { label: 'On track', width: (expected / max) * 100, className: 'bg-[#16a34a]' },
    { label: 'Lagging', width: ((warning - expected) / max) * 100, className: 'bg-[#f59e0b]' },
    { label: 'At risk', width: ((critical - warning) / max) * 100, className: 'bg-[#dc2626]' },
  ].map(segment => ({
    ...segment,
    width: Math.max(segment.width, 0),
  }));

  return (
    <div className="mt-4 space-y-2">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-[#f0f0f0]">
        {segments.map(segment => (
          <div key={segment.label} className={segment.className} style={{ width: `${segment.width}%` }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-3 text-[11px] text-[#737373]">
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#16a34a]" /> 0–{expected}d on track</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#f59e0b]" /> {expected}–{warning}d lagging</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#dc2626]" /> {critical}d+ at risk</span>
      </div>
    </div>
  );
}

function NumberStepper({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="rounded-xl border border-[#e5e5e5] bg-[#fafafa] p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#171717]">{label}</p>
          <p className="mt-0.5 text-xs text-[#737373]">{hint}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onChange(Math.max(0, value - 1))}
            className="tbo-focus grid h-8 w-8 place-items-center rounded-lg border border-[#d4d4d4] bg-white text-[#525252] hover:bg-[#f5f5f5]"
            aria-label={`Decrease ${label}`}
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <input
            type="number"
            min={0}
            value={value}
            onChange={event => onChange(parseInt(event.target.value, 10) || 0)}
            className="h-8 w-14 rounded-lg border border-[#d4d4d4] bg-white text-center text-sm font-semibold text-[#171717]"
          />
          <button
            type="button"
            onClick={() => onChange(value + 1)}
            className="tbo-focus grid h-8 w-8 place-items-center rounded-lg border border-[#d4d4d4] bg-white text-[#525252] hover:bg-[#f5f5f5]"
            aria-label={`Increase ${label}`}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function MentorshipCadencePanel({
  cadenceSettings,
  setCadenceSettings,
}: MentorshipCadencePanelProps) {
  const [draft, setDraft] = useState(cadenceSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft(cadenceSettings);
  }, [cadenceSettings]);

  const isDirty = useMemo(
    () => draft.inPerson.expectedDays !== cadenceSettings.inPerson.expectedDays
      || draft.inPerson.warningDays !== cadenceSettings.inPerson.warningDays
      || draft.inPerson.criticalDays !== cadenceSettings.inPerson.criticalDays,
    [cadenceSettings.inPerson, draft.inPerson]
  );

  const handleChange = useCallback((field: CadenceField, value: number) => {
    setDraft(prev => ({
      ...prev,
      inPerson: {
        ...prev.inPerson,
        [field]: value,
      },
    }));
    setSaved(false);
  }, []);

  const save = async () => {
    setIsSaving(true);
    setCadenceSettings({
      ...cadenceSettings,
      inPerson: draft.inPerson,
    });
    await new Promise(resolve => setTimeout(resolve, 300));
    setIsSaving(false);
    setSaved(true);
  };

  const settings = draft.inPerson;

  return (
    <div className="space-y-4">
      <SectionCard className="p-4 lg:p-5">
        <h3 className="font-semibold text-[#171717]">How check-in rules work</h3>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-[#737373]">
          Follow-up status is based on <strong className="font-medium text-[#525252]">in-person meetings only</strong>.
          Digital check-ins can still be logged for notes, but they do not affect at-risk or lagging flags.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            { step: '1', title: 'Expected', text: 'Ideal gap between face-to-face meetings' },
            { step: '2', title: 'Warning', text: 'Pair shows as lagging after this many days' },
            { step: '3', title: 'Critical', text: 'Pair shows as at risk — needs follow-up' },
          ].map(item => (
            <div key={item.step} className="rounded-xl border border-[#e5e5e5] bg-[#fafafa] p-3">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#171717] text-xs font-semibold text-white">
                {item.step}
              </span>
              <p className="mt-2 text-sm font-semibold text-[#171717]">{item.title}</p>
              <p className="mt-1 text-xs text-[#737373]">{item.text}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard className="p-4 lg:p-5 ring-1 ring-[#bbf7d0]">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-1 text-sm font-semibold text-[#15803d]">
          <Users className="h-4 w-4" />
          In-person meetings
        </div>
        <p className="text-sm text-[#737373]">
          These rules control when students appear as on track, lagging, or at risk on the Follow-up page.
        </p>

        <ThresholdPreview
          expected={settings.expectedDays}
          warning={settings.warningDays}
          critical={settings.criticalDays}
        />

        <div className="mt-4 space-y-3">
          {fieldMeta.map(({ field, label, hint }) => (
            <NumberStepper
              key={field}
              label={label}
              hint={hint}
              value={settings[field]}
              onChange={value => handleChange(field, value)}
            />
          ))}
        </div>
      </SectionCard>

      {(isDirty || saved) && (
        <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e5e5e5] bg-white/95 p-4 shadow-[0_8px_30px_rgba(0,0,0,0.08)] backdrop-blur">
          <p className="text-sm text-[#525252]">
            {saved && !isDirty ? (
              <span className="font-medium text-[#15803d]">Check-in rules saved.</span>
            ) : (
              <span>You have unsaved changes.</span>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setDraft(cadenceSettings);
                setSaved(false);
              }}
              disabled={!isDirty}
              className="rounded-lg border border-[#d4d4d4] px-4 py-2 text-sm font-semibold text-[#525252] hover:bg-[#f5f5f5] disabled:opacity-50"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={save}
              disabled={isSaving || !isDirty}
              className="inline-flex items-center gap-2 rounded-lg bg-[#171717] px-4 py-2 text-sm font-semibold text-white hover:bg-[#262626] disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'Saving…' : 'Save rules'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
