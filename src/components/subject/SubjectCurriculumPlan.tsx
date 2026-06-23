import type { ChangeEvent } from 'react';
import { FileUp, FileText, Download, Upload, Trash2 } from 'lucide-react';
import type { User } from '../../types/lms';
import { hasRole } from '../../utils/userUtils';
import { formatFileSize } from '../../utils/formatFileSize';
import {
  useSubjectCurriculumPlan,
  hasCurriculumPlanFile,
  hasLegacyCurriculumText,
} from '../../hooks/useSubjectCurriculumPlan';
import { LoadingSpinner } from '../ui/LoadingSpinner';

interface SubjectCurriculumPlanProps {
  subjectId: number;
  currentUser: User;
}

export function SubjectCurriculumPlan({
  subjectId,
  currentUser,
}: SubjectCurriculumPlanProps) {
  const isAdminOrTeacher =
    hasRole(currentUser, 'administrator') || hasRole(currentUser, 'teacher');

  const {
    plan,
    loading,
    saving,
    error,
    uploadCurriculumPlan,
    deleteCurriculumPlan,
  } = useSubjectCurriculumPlan(subjectId, currentUser);

  const hasFile = hasCurriculumPlanFile(plan);
  const hasLegacyText = hasLegacyCurriculumText(plan);

  const handleCurriculumPlanUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    await uploadCurriculumPlan(file);
  };

  const handleDeleteCurriculumPlan = async () => {
    if (!plan) return;
    if (!window.confirm('Remove the curriculum plan?')) return;
    await deleteCurriculumPlan();
  };

  if (loading) {
    return <LoadingSpinner message="Loading curriculum plan..." />;
  }

  if (!hasFile && !hasLegacyText && !isAdminOrTeacher) {
    return null;
  }

  const uploadArea = isAdminOrTeacher && !hasFile && (
    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
      <FileUp className="w-8 h-8 text-gray-400 mx-auto mb-2" />
      <p className="text-gray-500 text-sm mb-3">
        Upload the curriculum plan for this subject
      </p>
      <p className="text-gray-400 text-xs mb-4">
        PDF, Word, or any document format
      </p>
      <label
        className={`cursor-pointer px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 inline-block ${
          saving ? 'opacity-50 pointer-events-none' : ''
        }`}
      >
        Choose File
        <input
          type="file"
          className="hidden"
          onChange={handleCurriculumPlanUpload}
          disabled={saving}
        />
      </label>
    </div>
  );

  const legacyText = hasLegacyText && (
    <p className="text-sm text-gray-600 whitespace-pre-wrap mb-2">{plan!.content}</p>
  );

  const fileCard = hasFile && (
    <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
      <FileText className="w-8 h-8 text-amber-500 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 truncate">{plan!.fileName}</p>
        <p className="text-xs text-gray-500">
          Curriculum Plan · {formatFileSize(plan!.fileSize)}
        </p>
      </div>
      <a
        href={plan!.publicUrl!}
        target="_blank"
        rel="noopener noreferrer"
        download={plan!.fileName ?? undefined}
        className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 flex-shrink-0"
      >
        <Download className="w-4 h-4" />
        Download
      </a>
      {isAdminOrTeacher && (
        <label
          className={`cursor-pointer flex items-center gap-1 px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 flex-shrink-0 ${
            saving ? 'opacity-50 pointer-events-none' : ''
          }`}
        >
          <Upload className="w-4 h-4" />
          Replace
          <input
            type="file"
            className="hidden"
            onChange={handleCurriculumPlanUpload}
            disabled={saving}
          />
        </label>
      )}
      {isAdminOrTeacher && (
        <button
          type="button"
          onClick={handleDeleteCurriculumPlan}
          disabled={saving}
          className="p-1.5 text-gray-400 hover:text-red-500 flex-shrink-0 disabled:opacity-50"
          aria-label="Delete curriculum plan"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );

  return (
    <div className="mt-1 space-y-2">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {legacyText}
      {fileCard}
      {uploadArea}
    </div>
  );
}
