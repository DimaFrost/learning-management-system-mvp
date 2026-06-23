import { useState, useRef, type ChangeEvent } from 'react';
import { FileText, Download, Upload, Trash2 } from 'lucide-react';
import type { User } from '../../types/lms';
import { hasRole } from '../../utils/userUtils';
import { formatFileSize } from '../../utils/formatFileSize';
import {
  useSubjectCurriculumPlan,
  hasCurriculumPlanFile,
  hasLegacyCurriculumText,
} from '../../hooks/useSubjectCurriculumPlan';

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

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasFile = hasCurriculumPlanFile(plan);
  const hasLegacyText = hasLegacyCurriculumText(plan);

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) setPendingFile(file);
  };

  const handleSave = async () => {
    if (!pendingFile) return;
    await uploadCurriculumPlan(pendingFile);
    setPendingFile(null);
  };

  const handleCancel = () => {
    setPendingFile(null);
  };

  const handleDeleteCurriculumPlan = async () => {
    if (!plan) return;
    if (!window.confirm('Remove the curriculum plan?')) return;
    setPendingFile(null);
    await deleteCurriculumPlan();
  };

  if (loading) {
    return <p className="text-xs text-gray-500 mt-1">Loading curriculum plan...</p>;
  }

  if (!hasFile && !hasLegacyText && !isAdminOrTeacher) {
    return null;
  }

  const hiddenFileInput = (
    <input
      ref={fileInputRef}
      type="file"
      className="hidden"
      onChange={handleFileSelect}
      disabled={saving}
    />
  );

  const pendingRow = pendingFile && (
    <div className="flex flex-wrap items-center gap-1.5 mt-1">
      <FileText className="w-3 h-3 text-amber-500 flex-shrink-0" />
      <span className="text-xs text-gray-700 truncate min-w-0">
        {hasFile ? 'New: ' : ''}
        {pendingFile.name} · {formatFileSize(pendingFile.size)}
      </span>
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="px-2 py-1 bg-amber-500 text-white rounded-md text-xs font-medium hover:bg-amber-600 disabled:opacity-50"
      >
        Save
      </button>
      <button
        type="button"
        onClick={handleCancel}
        disabled={saving}
        className="px-2 py-1 border border-gray-300 text-gray-600 rounded-md text-xs hover:bg-gray-50 disabled:opacity-50"
      >
        Cancel
      </button>
    </div>
  );

  const publishedRow = hasFile && (
    <div className="flex flex-wrap items-center gap-1.5 mt-1">
      <FileText className="w-3 h-3 text-amber-500 flex-shrink-0" />
      <span className="text-xs text-gray-700 truncate min-w-0">
        {plan!.fileName} · {formatFileSize(plan!.fileSize)}
      </span>
      <a
        href={plan!.publicUrl!}
        target="_blank"
        rel="noopener noreferrer"
        download={plan!.fileName ?? undefined}
        className="flex items-center gap-0.5 px-2 py-1 bg-amber-500 text-white rounded-md text-xs font-medium hover:bg-amber-600 flex-shrink-0"
      >
        <Download className="w-3 h-3" />
        Download
      </a>
      {isAdminOrTeacher && !pendingFile && (
        <>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={saving}
            className="flex items-center gap-0.5 px-2 py-1 border border-gray-300 text-gray-600 rounded-md text-xs hover:bg-gray-50 disabled:opacity-50"
          >
            <Upload className="w-3 h-3" />
            Replace
          </button>
          <button
            type="button"
            onClick={handleDeleteCurriculumPlan}
            disabled={saving}
            className="p-1 text-gray-400 hover:text-red-500 flex-shrink-0 disabled:opacity-50"
            aria-label="Delete curriculum plan"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </>
      )}
    </div>
  );

  const curriculumPlanButton = isAdminOrTeacher && !hasFile && !pendingFile && (
    <button
      type="button"
      onClick={() => fileInputRef.current?.click()}
      disabled={saving}
      className="mt-1 px-2 py-1 bg-amber-500 text-white rounded-md text-xs font-medium hover:bg-amber-600 disabled:opacity-50"
    >
      Curriculum plan
    </button>
  );

  const legacyText = hasLegacyText && (
    <p className="text-sm text-gray-600 whitespace-pre-wrap mt-1">{plan!.content}</p>
  );

  return (
    <div>
      {hiddenFileInput}
      {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
      {legacyText}
      {publishedRow}
      {pendingRow}
      {curriculumPlanButton}
    </div>
  );
}
