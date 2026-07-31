import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { User, CourseStudent } from '../../types/lms';
import { useLanguage } from '../../i18n/LanguageContext';

interface MentorAssignModalProps {
  isOpen: boolean;
  studentId: string | null;
  users: User[];
  courseStudents: CourseStudent[];
  onAssign: (studentId: string, mentorId: string) => void | Promise<void>;
  onClose: () => void;
}

export function MentorAssignModal({
  isOpen,
  studentId,
  users,
  courseStudents,
  onAssign,
  onClose,
}: MentorAssignModalProps) {
  const { t } = useLanguage();
  const [newMentorId, setNewMentorId] = useState<string>('');

  useEffect(() => {
    if (!isOpen) {
      setNewMentorId('');
    }
  }, [isOpen]);

  if (!isOpen || studentId === null) {
    return null;
  }

  const enrollment = courseStudents.find(cs => cs.studentId === studentId && !cs.mentorId)
    ?? courseStudents.find(cs => cs.studentId === studentId);
  const hasEnrollment = enrollment != null;
  const isAssignMode = !enrollment?.mentorId;
  const availableMentors = users.filter(u => u.roles.includes('mentor'));
  const student = users.find(u => u.id === studentId);

  const handleClose = () => {
    setNewMentorId('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-xl sm:rounded-lg p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">
            {isAssignMode ? t('mentor.assign.assignTitle') : t('mentor.assign.changeTitle')}
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('mentor.assign.student')}</label>
            <p className="text-sm text-gray-900">
              {student?.name}
            </p>
          </div>

          {!hasEnrollment && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-900">
              {t('mentor.assign.enrollmentRequired')}
            </div>
          )}

          {hasEnrollment && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('mentor.assign.selectMentor')}</label>
              <select
                value={newMentorId}
                onChange={(e) => setNewMentorId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">{t('mentor.assign.selectMentorPlaceholder')}</option>
                {availableMentors.map(mentor => (
                  <option key={mentor.id} value={mentor.id}>{mentor.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              {t('common.cancel')}
            </button>
            {hasEnrollment && (
              <button
                onClick={async () => {
                  if (newMentorId) {
                    await onAssign(studentId, newMentorId);
                  }
                }}
                disabled={!newMentorId}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
              >
                {isAssignMode ? t('mentor.assign.assignButton') : t('mentor.assign.changeButton')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
