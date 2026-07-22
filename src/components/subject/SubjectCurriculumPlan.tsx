import { useState, useRef, type ChangeEvent } from 'react';
import { Download, ExternalLink, FileText, Trash2, Upload } from 'lucide-react';
import type { User } from '../../types/lms';
import { hasRole } from '../../utils/userUtils';
import { formatFileSize } from '../../utils/formatFileSize';
import { formatPlatformDate } from '../../utils/dateUtils';
import { type FilePreviewItem } from '../../utils/filePreview';
import { FilePreviewModal } from '../modals/FilePreviewModal';
import {
  useSubjectCurriculumPlan,
  hasCurriculumPlanFile,
  hasLegacyCurriculumText,
} from '../../hooks/useSubjectCurriculumPlan';

interface SubjectCurriculumPlanProps {
  subjectId: number;
  currentUser: User;
  layout?: 'default' | 'materials';
}

function resolveCurriculumPlanPreview(params: {
  fileName: string;
  publicUrl: string;
  mimeType: string | null;
}): FilePreviewItem | null {
  const { fileName, publicUrl, mimeType } = params;
  const lower = fileName.toLowerCase();
  const isPdf = mimeType === 'application/pdf' || lower.endsWith('.pdf');
  const isImage =
    Boolean(mimeType?.startsWith('image/')) ||
    /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(fileName);
  const isWord =
    Boolean(mimeType?.includes('word')) ||
    lower.endsWith('.doc') ||
    lower.endsWith('.docx');

  if (isPdf) {
    return {
      title: fileName,
      url: publicUrl,
      previewUrl: publicUrl,
      downloadUrl: publicUrl,
      fileName,
      mimeType,
      mode: 'pdf',
      typeLabel: 'PDF',
    };
  }
  if (isImage) {
    return {
      title: fileName,
      url: publicUrl,
      previewUrl: publicUrl,
      downloadUrl: publicUrl,
      fileName,
      mimeType,
      mode: 'image',
      typeLabel: 'Image',
    };
  }
  if (isWord) {
    return {
      title: fileName,
      url: publicUrl,
      previewUrl: `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(publicUrl)}`,
      downloadUrl: publicUrl,
      fileName,
      mimeType,
      mode: 'office',
      typeLabel: 'Word document',
    };
  }
  return null;
}

export function SubjectCurriculumPlan({
  subjectId,
  currentUser,
  layout = 'default',
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
  const [previewItem, setPreviewItem] = useState<FilePreviewItem | null>(null);
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

  const openPublishedFile = () => {
    if (!plan?.publicUrl || !plan.fileName) return;
    const preview = resolveCurriculumPlanPreview({
      fileName: plan.fileName,
      publicUrl: plan.publicUrl,
      mimeType: plan.mimeType,
    });
    if (preview) {
      setPreviewItem(preview);
      return;
    }
    window.open(plan.publicUrl, '_blank', 'noopener,noreferrer');
  };

  const hiddenFileInput = (
    <input
      ref={fileInputRef}
      type="file"
      className="hidden"
      onChange={handleFileSelect}
      disabled={saving}
    />
  );

  if (layout === 'materials') {
    if (loading) {
      return <div className="py-6 text-sm text-[#737373]">Loading curriculum plan...</div>;
    }

    return (
      <>
        {hiddenFileInput}
        {error && <p className="py-3 text-sm font-semibold text-[#dc2626]">{error}</p>}
        {hasLegacyText && (
          <div className="border-b border-[#e5e5e5] px-4 py-3 text-sm text-[#525252] whitespace-pre-wrap">
            {plan!.content}
          </div>
        )}
        {!hasFile && !pendingFile ? (
          <div className="py-6 text-sm text-[#737373]">
            {isAdminOrTeacher ? (
              <div className="flex flex-wrap items-center gap-2">
                <span>No curriculum plan yet.</span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={saving}
                  className="tbo-focus inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#d4d4d4] bg-white px-2.5 text-xs font-semibold text-[#171717] hover:bg-[#f5f5f5] disabled:opacity-50"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Upload
                </button>
              </div>
            ) : (
              'No curriculum plan yet.'
            )}
          </div>
        ) : null}

        {hasFile && (
          <div className="-mx-4 grid w-[calc(100%+2rem)] items-center gap-3 px-4 py-3 md:grid-cols-[28px_minmax(0,1fr)_auto]">
            <FileText className="h-4 w-4 text-[#171717]" />
            <div className="min-w-0">
              <button
                type="button"
                onClick={openPublishedFile}
                className="tbo-focus block max-w-full truncate text-left text-sm font-semibold text-[#171717] hover:underline"
              >
                {plan!.fileName}
              </button>
              <p className="mt-1 text-xs text-[#737373]">
                {formatPlatformDate(plan!.updatedAt || plan!.createdAt)}
                {plan!.fileSize != null ? ` · ${formatFileSize(plan!.fileSize)}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <a
                href={plan!.publicUrl!}
                target="_blank"
                rel="noreferrer"
                className="tbo-focus grid h-8 w-8 place-items-center rounded-lg text-[#737373] hover:bg-[#f5f5f5] hover:text-[#171717]"
                title="Open in new tab"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <a
                href={plan!.publicUrl!}
                download={plan!.fileName ?? undefined}
                className="tbo-focus grid h-8 w-8 place-items-center rounded-lg text-[#737373] hover:bg-[#f5f5f5] hover:text-[#171717]"
                title="Download"
              >
                <Download className="h-3.5 w-3.5" />
              </a>
              {isAdminOrTeacher && !pendingFile && (
                <>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={saving}
                    className="tbo-focus grid h-8 w-8 place-items-center rounded-lg text-[#737373] hover:bg-[#f5f5f5] hover:text-[#171717] disabled:opacity-50"
                    title="Replace"
                  >
                    <Upload className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteCurriculumPlan()}
                    disabled={saving}
                    className="tbo-focus grid h-8 w-8 place-items-center rounded-lg text-[#737373] hover:bg-[#fef2f2] hover:text-[#dc2626] disabled:opacity-50"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {pendingFile && (
          <div className="space-y-2 border-t border-[#e5e5e5] px-4 py-3">
            <p className="text-sm font-semibold text-[#171717]">
              {hasFile ? 'Replace with' : 'Ready to upload'}: {pendingFile.name}
              {' · '}
              {formatFileSize(pendingFile.size)}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="tbo-focus inline-flex h-8 items-center rounded-lg bg-[#171717] px-3 text-xs font-semibold text-white hover:bg-[#262626] disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                className="tbo-focus inline-flex h-8 items-center rounded-lg border border-[#d4d4d4] bg-white px-3 text-xs font-semibold text-[#525252] hover:bg-[#f5f5f5] disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <FilePreviewModal item={previewItem} onClose={() => setPreviewItem(null)} />
      </>
    );
  }

  if (loading) {
    return <p className="text-xs text-gray-500 mt-1">Loading curriculum plan...</p>;
  }

  if (!hasFile && !hasLegacyText && !isAdminOrTeacher) {
    return null;
  }

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
