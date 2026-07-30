import { useState, useEffect, type FormEvent } from 'react';
import type {
  EditingItem,
  MentorshipEngagement,
  MentorshipInPersonMeeting,
  MentorshipLog,
  MentorshipMeetingsCount,
  MentorshipStayedInTouch,
  User,
} from '../../types/lms';
import { useLanguage } from '../../i18n/LanguageContext';
import { X, Save } from 'lucide-react';

interface LogCheckinModalProps {
  editingItem: EditingItem | null;
  currentUser: User;
  onClose: () => void;
  onAddLog: (logData: Partial<MentorshipLog>, currentUserId: string) => void;
  onUpdateLog: (id: number, updates: Partial<MentorshipLog>) => void;
  getUserById: (id: string | null) => User | undefined;
}

type FormErrors = Record<string, string>;

function todayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function currentMonthIndex(): number {
  return new Date().getMonth();
}

function currentYear(): number {
  return new Date().getFullYear();
}

function yearOptions(includeYear?: number): number[] {
  const year = currentYear();
  const years = new Set([year - 2, year - 1, year, year + 1]);
  if (includeYear) years.add(includeYear);
  return Array.from(years).sort((a, b) => b - a);
}

function composeMeetingMonth(monthIndex: number, year: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}

function parseMeetingMonth(value?: string): { monthIndex: number; year: number } {
  const match = value?.match(/^(\d{4})-(\d{2})$/);
  if (match) {
    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    if (monthIndex >= 0 && monthIndex <= 11 && Number.isFinite(year)) {
      return { monthIndex, year };
    }
  }
  return { monthIndex: currentMonthIndex(), year: currentYear() };
}

const MONTH_KEYS = [
  'checkin.month.january',
  'checkin.month.february',
  'checkin.month.march',
  'checkin.month.april',
  'checkin.month.may',
  'checkin.month.june',
  'checkin.month.july',
  'checkin.month.august',
  'checkin.month.september',
  'checkin.month.october',
  'checkin.month.november',
  'checkin.month.december',
] as const;

export function LogCheckinModal({ editingItem, currentUser, onClose, onAddLog, onUpdateLog, getUserById }: LogCheckinModalProps) {
  const { t } = useLanguage();
  const [selectedMonth, setSelectedMonth] = useState(currentMonthIndex);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [inPersonMeeting, setInPersonMeeting] = useState<MentorshipInPersonMeeting | ''>('');
  const [meetingsCount, setMeetingsCount] = useState<MentorshipMeetingsCount | ''>('');
  const [stayedInTouch, setStayedInTouch] = useState<MentorshipStayedInTouch | ''>('');
  const [mainTopic, setMainTopic] = useState('');
  const [engagement, setEngagement] = useState<MentorshipEngagement | ''>('');
  const [challenges, setChallenges] = useState('');
  const [schoolSupport, setSchoolSupport] = useState('');
  const [positiveMoment, setPositiveMoment] = useState('');
  const [otherObservations, setOtherObservations] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});

  const isEditing = editingItem?.type === 'log' && editingItem?.data;
  const existingLog = isEditing ? editingItem.data as MentorshipLog : null;

  useEffect(() => {
    if (existingLog) {
      const parsed = parseMeetingMonth(existingLog.meetingMonth);
      setSelectedMonth(parsed.monthIndex);
      setSelectedYear(parsed.year);
      setInPersonMeeting(existingLog.inPersonMeeting || '');
      setMeetingsCount(existingLog.meetingsCount || '');
      setStayedInTouch(existingLog.stayedInTouch || '');
      setMainTopic(existingLog.mainTopic || '');
      setEngagement(existingLog.engagement || '');
      setChallenges(existingLog.challenges || '');
      setSchoolSupport(existingLog.schoolSupport || '');
      setPositiveMoment(existingLog.positiveMoment || '');
      setOtherObservations(existingLog.otherObservations || '');
    } else {
      setSelectedMonth(currentMonthIndex());
      setSelectedYear(currentYear());
      setInPersonMeeting('');
      setMeetingsCount('');
      setStayedInTouch('');
      setMainTopic('');
      setEngagement('');
      setChallenges('');
      setSchoolSupport('');
      setPositiveMoment('');
      setOtherObservations('');
    }
    setErrors({});
  }, [existingLog]);

  const resetForm = () => {
    setSelectedMonth(currentMonthIndex());
    setSelectedYear(currentYear());
    setInPersonMeeting('');
    setMeetingsCount('');
    setStayedInTouch('');
    setMainTopic('');
    setEngagement('');
    setChallenges('');
    setSchoolSupport('');
    setPositiveMoment('');
    setOtherObservations('');
    setErrors({});
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const newErrors: FormErrors = {};

    if (selectedMonth < 0 || selectedMonth > 11 || !selectedYear) {
      newErrors.meetingMonth = t('checkin.error.required');
    }
    if (!inPersonMeeting) newErrors.inPersonMeeting = t('checkin.error.required');
    if (!meetingsCount) newErrors.meetingsCount = t('checkin.error.required');
    if (!stayedInTouch) newErrors.stayedInTouch = t('checkin.error.required');
    if (!mainTopic.trim()) newErrors.mainTopic = t('checkin.error.required');
    if (!engagement) newErrors.engagement = t('checkin.error.required');

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const typedInPerson = inPersonMeeting as MentorshipInPersonMeeting;
    const logData: Partial<MentorshipLog> = {
      type: typedInPerson === 'yes' ? 'in_person' : 'digital',
      date: todayDateString(),
      meetingMonth: composeMeetingMonth(selectedMonth, selectedYear),
      inPersonMeeting: typedInPerson,
      meetingsCount: meetingsCount as MentorshipMeetingsCount,
      stayedInTouch: stayedInTouch as MentorshipStayedInTouch,
      mainTopic: mainTopic.trim(),
      engagement: engagement as MentorshipEngagement,
      challenges: challenges.trim() || undefined,
      schoolSupport: schoolSupport.trim() || undefined,
      positiveMoment: positiveMoment.trim() || undefined,
      otherObservations: otherObservations.trim() || undefined,
      notes: mainTopic.trim(),
      duration: undefined,
      topics: undefined,
      nextSteps: undefined,
      studentProgress: undefined,
    };

    if (isEditing && existingLog) {
      onUpdateLog(existingLog.id, logData);
    } else {
      onAddLog({
        ...logData,
        mentorId: currentUser.id,
        studentId: editingItem?.studentId!,
      }, currentUser.id);
    }

    onClose();
    resetForm();
  };

  if (!editingItem || editingItem.type !== 'log') return null;

  const student = editingItem.studentId ? getUserById(editingItem.studentId) : undefined;
  const years = yearOptions(selectedYear);

  const radioClass = 'flex items-start gap-2 rounded-lg border border-gray-200 px-3 py-2 hover:bg-gray-50 cursor-pointer';
  const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-xl sm:rounded-lg p-4 sm:p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">
            {isEditing ? t('checkin.title.edit') : t('checkin.title.new')} {student?.name}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label={t('checkin.cancel')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('checkin.month.label')}</label>
            <div className="grid grid-cols-2 gap-3">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className={inputClass}
              >
                {MONTH_KEYS.map((key, monthIndex) => (
                  <option key={key} value={monthIndex}>
                    {t(key)}
                  </option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className={inputClass}
              >
                {years.map(year => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
            {errors.meetingMonth && <p className="text-red-500 text-sm mt-1">{errors.meetingMonth}</p>}
          </div>

          <fieldset>
            <legend className="block text-sm font-medium text-gray-700 mb-2">{t('checkin.q1.label')}</legend>
            <div className="space-y-2">
              {([
                ['yes', 'checkin.q1.yes'],
                ['planned_soon', 'checkin.q1.plannedSoon'],
                ['unable', 'checkin.q1.unable'],
              ] as const).map(([value, key]) => (
                <label key={value} className={radioClass}>
                  <input
                    type="radio"
                    name="inPersonMeeting"
                    checked={inPersonMeeting === value}
                    onChange={() => setInPersonMeeting(value)}
                    className="mt-1"
                  />
                  <span className="text-sm text-gray-700">{t(key)}</span>
                </label>
              ))}
            </div>
            {errors.inPersonMeeting && <p className="text-red-500 text-sm mt-1">{errors.inPersonMeeting}</p>}
          </fieldset>

          <fieldset>
            <legend className="block text-sm font-medium text-gray-700 mb-2">{t('checkin.q2.label')}</legend>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {([
                ['0', 'checkin.q2.0'],
                ['1', 'checkin.q2.1'],
                ['2', 'checkin.q2.2'],
                ['more_than_2', 'checkin.q2.moreThan2'],
              ] as const).map(([value, key]) => (
                <label key={value} className={radioClass}>
                  <input
                    type="radio"
                    name="meetingsCount"
                    checked={meetingsCount === value}
                    onChange={() => setMeetingsCount(value)}
                    className="mt-1"
                  />
                  <span className="text-sm text-gray-700">{t(key)}</span>
                </label>
              ))}
            </div>
            {errors.meetingsCount && <p className="text-red-500 text-sm mt-1">{errors.meetingsCount}</p>}
          </fieldset>

          <fieldset>
            <legend className="block text-sm font-medium text-gray-700 mb-2">{t('checkin.q3.label')}</legend>
            <div className="space-y-2">
              {([
                ['regularly', 'checkin.q3.regularly'],
                ['occasionally', 'checkin.q3.occasionally'],
                ['no', 'checkin.q3.no'],
              ] as const).map(([value, key]) => (
                <label key={value} className={radioClass}>
                  <input
                    type="radio"
                    name="stayedInTouch"
                    checked={stayedInTouch === value}
                    onChange={() => setStayedInTouch(value)}
                    className="mt-1"
                  />
                  <span className="text-sm text-gray-700">{t(key)}</span>
                </label>
              ))}
            </div>
            {errors.stayedInTouch && <p className="text-red-500 text-sm mt-1">{errors.stayedInTouch}</p>}
          </fieldset>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('checkin.q4.label')}</label>
            <input
              type="text"
              value={mainTopic}
              onChange={(e) => setMainTopic(e.target.value)}
              className={inputClass}
            />
            {errors.mainTopic && <p className="text-red-500 text-sm mt-1">{errors.mainTopic}</p>}
          </div>

          <fieldset>
            <legend className="block text-sm font-medium text-gray-700 mb-2">{t('checkin.q5.label')}</legend>
            <div className="space-y-2">
              {([
                ['very_high', 'checkin.q5.veryHigh'],
                ['good', 'checkin.q5.good'],
                ['moderate', 'checkin.q5.moderate'],
                ['low', 'checkin.q5.low'],
              ] as const).map(([value, key]) => (
                <label key={value} className={radioClass}>
                  <input
                    type="radio"
                    name="engagement"
                    checked={engagement === value}
                    onChange={() => setEngagement(value)}
                    className="mt-1"
                  />
                  <span className="text-sm text-gray-700">{t(key)}</span>
                </label>
              ))}
            </div>
            {errors.engagement && <p className="text-red-500 text-sm mt-1">{errors.engagement}</p>}
          </fieldset>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('checkin.q6.label')}</label>
            <textarea
              value={challenges}
              onChange={(e) => setChallenges(e.target.value)}
              rows={2}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('checkin.q7.label')}</label>
            <textarea
              value={schoolSupport}
              onChange={(e) => setSchoolSupport(e.target.value)}
              rows={2}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('checkin.q8.label')}</label>
            <textarea
              value={positiveMoment}
              onChange={(e) => setPositiveMoment(e.target.value)}
              rows={2}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('checkin.q9.label')}</label>
            <textarea
              value={otherObservations}
              onChange={(e) => setOtherObservations(e.target.value)}
              rows={2}
              className={inputClass}
            />
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              {t('checkin.cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
            >
              <Save className="w-4 h-4" />
              <span>{isEditing ? t('checkin.save.update') : t('checkin.save.create')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
