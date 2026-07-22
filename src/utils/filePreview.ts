import type { AnnouncementAttachment, ClassFile, HomeworkSubmission } from '../types/lms';

export type FilePreviewMode = 'pdf' | 'image' | 'office' | 'google';

export interface FilePreviewItem {
  title: string;
  url: string;
  previewUrl: string;
  downloadUrl: string;
  fileName: string | null;
  mimeType: string | null;
  mode: FilePreviewMode;
  typeLabel: string;
}

function getExtension(fileName?: string | null): string {
  if (!fileName) return '';
  const match = fileName.match(/\.([a-z0-9]+)$/i);
  return match?.[1]?.toLowerCase() ?? '';
}

function isPdf(mimeType?: string | null, fileName?: string | null): boolean {
  return mimeType === 'application/pdf' || getExtension(fileName) === 'pdf';
}

function isImage(mimeType?: string | null, fileName?: string | null): boolean {
  if (mimeType?.startsWith('image/')) return true;
  return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(getExtension(fileName));
}

function isWordDocument(mimeType?: string | null, fileName?: string | null): boolean {
  if (mimeType?.includes('word')) return true;
  const ext = getExtension(fileName);
  return ext === 'doc' || ext === 'docx';
}

function getOfficeEmbedUrl(fileUrl: string): string {
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`;
}

function getGoogleEmbedUrl(
  linkUrl: string,
  attachmentType: Extract<AnnouncementAttachment['attachmentType'], 'google_doc' | 'google_sheet' | 'google_slide'>
): string | null {
  const docMatch = linkUrl.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  const sheetMatch = linkUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  const slideMatch = linkUrl.match(/\/presentation\/d\/([a-zA-Z0-9_-]+)/);

  if (attachmentType === 'google_doc' && docMatch) {
    return `https://docs.google.com/document/d/${docMatch[1]}/preview`;
  }
  if (attachmentType === 'google_sheet' && sheetMatch) {
    return `https://docs.google.com/spreadsheets/d/${sheetMatch[1]}/preview`;
  }
  if (attachmentType === 'google_slide' && slideMatch) {
    return `https://docs.google.com/presentation/d/${slideMatch[1]}/embed?start=false&loop=false&delayms=3000`;
  }

  return linkUrl.replace(/\/edit(\?.*)?$/, '/preview');
}

function getDrivePreviewUrl(fileId: string | null | undefined): string | null {
  if (!fileId) return null;
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

export function canPreviewInApp(attachment: AnnouncementAttachment): boolean {
  return resolveAnnouncementPreview(attachment) !== null;
}

export function resolveAnnouncementPreview(attachment: AnnouncementAttachment): FilePreviewItem | null {
  const url = attachment.attachmentType === 'file' ? attachment.publicUrl : attachment.linkUrl;
  if (!url) return null;

  const title = attachment.fileName ?? attachment.linkTitle ?? 'Attachment';
  const fileName = attachment.fileName;
  const mimeType = attachment.mimeType;

  if (attachment.attachmentType === 'google_doc' || attachment.attachmentType === 'google_sheet' || attachment.attachmentType === 'google_slide') {
    const previewUrl = getGoogleEmbedUrl(url, attachment.attachmentType);
    if (!previewUrl) return null;

    const typeLabel =
      attachment.attachmentType === 'google_doc'
        ? 'Google Doc'
        : attachment.attachmentType === 'google_sheet'
          ? 'Google Sheet'
          : 'Google Slides';

    return {
      title,
      url,
      previewUrl,
      downloadUrl: url,
      fileName,
      mimeType,
      mode: 'google',
      typeLabel,
    };
  }

  if (isPdf(mimeType, fileName)) {
    return {
      title,
      url,
      previewUrl: getDrivePreviewUrl(attachment.storagePath) ?? url,
      downloadUrl: url,
      fileName,
      mimeType,
      mode: 'pdf',
      typeLabel: 'PDF',
    };
  }

  if (isImage(mimeType, fileName)) {
    return {
      title,
      url,
      previewUrl: getDrivePreviewUrl(attachment.storagePath) ?? url,
      downloadUrl: url,
      fileName,
      mimeType,
      mode: 'image',
      typeLabel: 'Image',
    };
  }

  if (isWordDocument(mimeType, fileName)) {
    return {
      title,
      url,
      previewUrl: getDrivePreviewUrl(attachment.storagePath) ?? getOfficeEmbedUrl(url),
      downloadUrl: url,
      fileName,
      mimeType,
      mode: 'office',
      typeLabel: getExtension(fileName) === 'doc' ? 'Word document' : 'Word document',
    };
  }

  return null;
}

export function resolveClassFilePreview(file: ClassFile): FilePreviewItem | null {
  const url = file.driveViewUrl;
  const title = file.fileName;
  const fileName = file.fileName;
  const mimeType = file.mimeType;

  if (mimeType === 'application/vnd.google-apps.document') {
    const previewUrl = getGoogleEmbedUrl(url, 'google_doc');
    if (!previewUrl) return null;
    return {
      title,
      url,
      previewUrl,
      downloadUrl: url,
      fileName,
      mimeType,
      mode: 'google',
      typeLabel: 'Google Doc',
    };
  }

  if (isPdf(mimeType, fileName)) {
    return {
      title,
      url,
      previewUrl: getDrivePreviewUrl(file.storagePath) ?? url,
      downloadUrl: url,
      fileName,
      mimeType,
      mode: 'pdf',
      typeLabel: 'PDF',
    };
  }

  if (isImage(mimeType, fileName)) {
    return {
      title,
      url,
      previewUrl: getDrivePreviewUrl(file.storagePath) ?? url,
      downloadUrl: url,
      fileName,
      mimeType,
      mode: 'image',
      typeLabel: 'Image',
    };
  }

  if (isWordDocument(mimeType, fileName)) {
    return {
      title,
      url,
      previewUrl: getDrivePreviewUrl(file.storagePath) ?? getOfficeEmbedUrl(url),
      downloadUrl: url,
      fileName,
      mimeType,
      mode: 'office',
      typeLabel: 'Word document',
    };
  }

  return getDrivePreviewUrl(file.storagePath)
    ? {
        title,
        url,
        previewUrl: getDrivePreviewUrl(file.storagePath)!,
        downloadUrl: url,
        fileName,
        mimeType,
        mode: 'google',
        typeLabel: 'Drive file',
      }
    : null;
}

export function canPreviewClassFile(file: ClassFile): boolean {
  return resolveClassFilePreview(file) !== null;
}

export function resolveHomeworkSubmissionPreview(submission: HomeworkSubmission): FilePreviewItem | null {
  const fileName = submission.fileName;
  const title = fileName ?? submission.studentName ?? 'Submission';
  const googleUrl = submission.googleDocUrl;
  const driveUrl = submission.driveViewUrl;
  const driveFileId = submission.driveFileId ?? submission.googleDocId;

  if (submission.submissionType === 'google_doc' || googleUrl) {
    const url = googleUrl ?? driveUrl;
    if (!url) return null;
    const previewUrl = getGoogleEmbedUrl(url, 'google_doc');
    if (!previewUrl) return null;
    return {
      title,
      url,
      previewUrl,
      downloadUrl: url,
      fileName,
      mimeType: 'application/vnd.google-apps.document',
      mode: 'google',
      typeLabel: 'Google Doc',
    };
  }

  const url = driveUrl ?? googleUrl;
  if (!url) return null;

  if (isPdf(null, fileName)) {
    return {
      title,
      url,
      previewUrl: getDrivePreviewUrl(driveFileId) ?? url,
      downloadUrl: url,
      fileName,
      mimeType: 'application/pdf',
      mode: 'pdf',
      typeLabel: 'PDF',
    };
  }

  if (isImage(null, fileName)) {
    return {
      title,
      url,
      previewUrl: getDrivePreviewUrl(driveFileId) ?? url,
      downloadUrl: url,
      fileName,
      mimeType: null,
      mode: 'image',
      typeLabel: 'Image',
    };
  }

  if (isWordDocument(null, fileName)) {
    return {
      title,
      url,
      previewUrl: getDrivePreviewUrl(driveFileId) ?? getOfficeEmbedUrl(url),
      downloadUrl: url,
      fileName,
      mimeType: null,
      mode: 'office',
      typeLabel: 'Word document',
    };
  }

  const drivePreview = getDrivePreviewUrl(driveFileId);
  if (drivePreview) {
    return {
      title,
      url,
      previewUrl: drivePreview,
      downloadUrl: url,
      fileName,
      mimeType: null,
      mode: 'google',
      typeLabel: 'Drive file',
    };
  }

  return null;
}

export function canPreviewLocalFile(file: File): boolean {
  return isPdf(file.type, file.name) || isImage(file.type, file.name);
}

export function resolveLocalFilePreview(file: File, title?: string): FilePreviewItem | null {
  const url = URL.createObjectURL(file);
  const fileName = file.name;
  const mimeType = file.type;

  if (isPdf(mimeType, fileName)) {
    return {
      title: title ?? fileName,
      url,
      previewUrl: url,
      downloadUrl: url,
      fileName,
      mimeType,
      mode: 'pdf',
      typeLabel: 'PDF',
    };
  }

  if (isImage(mimeType, fileName)) {
    return {
      title: title ?? fileName,
      url,
      previewUrl: url,
      downloadUrl: url,
      fileName,
      mimeType,
      mode: 'image',
      typeLabel: 'Image',
    };
  }

  URL.revokeObjectURL(url);
  return null;
}
