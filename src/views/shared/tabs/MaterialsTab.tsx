import { useState, useRef, type ChangeEvent } from 'react';
import {
  Pencil,
  Trash,
  Plus,
  File as FileIcon,
  FileText,
  FileVideo,
  Image,
  ExternalLink,
  Upload,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ClassNote, ClassFile, User, Course, Subject, Class } from '../../../types/lms';
import { hasRole } from '../../../utils/userUtils';
import { getCourseDisplayName } from '../../../utils/courseUtils';
import { formatFileSize } from '../../../utils/formatFileSize';
import { formatPlatformDate } from '../../../utils/dateUtils';
import { resolveClassFilePreview, type FilePreviewItem } from '../../../utils/filePreview';
import { FilePreviewModal } from '../../../components/modals/FilePreviewModal';

interface MaterialsTabProps {
  classId: number;
  currentUser: User;
  notes: ClassNote[];
  files: ClassFile[];
  saving: boolean;
  onAddNote: (data: {
    noteType: ClassNote['noteType'];
    title: string | null;
    content: string;
  }) => Promise<void>;
  onUpdateNote: (
    id: number,
    updates: { title?: string | null; content: string }
  ) => Promise<void>;
  onDeleteNote: (id: number) => Promise<void>;
  onUploadFile: (params: {
    file: File;
    fileType: 'material';
    courseSlug: string;
    subjectSlug: string;
    classSlug: string;
  }) => Promise<boolean>;
  onCreateGoogleDocMaterial: (params: { title: string }) => Promise<boolean>;
  onMaterialsUploaded: (fileNames: string[]) => Promise<void>;
  onDeleteFile: (file: ClassFile) => Promise<void>;
  selectedCourse: Course;
  selectedSubject: Subject;
  selectedClass: Class;
}

function formatDate(dateString: string): string {
  return formatPlatformDate(dateString);
}

function getFileIcon(mimeType: string | null): LucideIcon {
  if (mimeType?.startsWith('image/')) return Image;
  if (mimeType?.includes('pdf')) return FileText;
  if (mimeType?.includes('video')) return FileVideo;
  return FileIcon;
}

export function MaterialsTab({
  currentUser,
  notes,
  files,
  saving,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
  onUploadFile,
  onCreateGoogleDocMaterial,
  onMaterialsUploaded,
  onDeleteFile,
  selectedCourse,
  selectedSubject,
  selectedClass,
}: MaterialsTabProps) {
  const canManageNotes =
    hasRole(currentUser, 'administrator') || hasRole(currentUser, 'teacher');
  const isAdmin = hasRole(currentUser, 'administrator');

  const [isAddingNote, setIsAddingNote] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editNoteTitle, setEditNoteTitle] = useState('');
  const [editNoteContent, setEditNoteContent] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isCreatingDoc, setIsCreatingDoc] = useState(false);
  const [materialDocTitle, setMaterialDocTitle] = useState('');
  const [previewItem, setPreviewItem] = useState<FilePreviewItem | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadSlugs = {
    courseSlug: getCourseDisplayName(selectedCourse)
      .toLowerCase()
      .replace(/\s+/g, '-'),
    subjectSlug: selectedSubject.title.toLowerCase().replace(/\s+/g, '-'),
    classSlug: `${selectedClass.date ?? 'no-date'}-${selectedClass.title.toLowerCase().replace(/\s+/g, '-')}`,
  };

  const studentNotes = notes.filter(n => n.noteType === 'student_note');

  const handleAddNote = async () => {
    const content = newNoteContent.trim();
    if (!content) return;
    await onAddNote({
      noteType: 'student_note',
      title: newNoteTitle.trim() || null,
      content,
    });
    setIsAddingNote(false);
    setNewNoteTitle('');
    setNewNoteContent('');
  };

  const startEditNote = (note: ClassNote) => {
    setEditingNoteId(note.id);
    setEditNoteTitle(note.title ?? '');
    setEditNoteContent(note.content);
  };

  const cancelEditNote = () => {
    setEditingNoteId(null);
    setEditNoteTitle('');
    setEditNoteContent('');
  };

  const handleSaveNote = async (id: number) => {
    const content = editNoteContent.trim();
    if (!content) return;
    await onUpdateNote(id, {
      title: editNoteTitle.trim() || null,
      content,
    });
    cancelEditNote();
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const added = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (added.length === 0) return;

    setPendingFiles(prev => {
      const existing = new Set(prev.map(f => `${f.name}:${f.size}`));
      return [...prev, ...added.filter(f => !existing.has(`${f.name}:${f.size}`))];
    });
  };

  const handleRemovePending = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleCancelPending = () => {
    setPendingFiles([]);
  };

  const handleConfirmUpload = async () => {
    if (pendingFiles.length === 0) return;

    const queue = [...pendingFiles];
    const remaining: File[] = [];
    const uploadedNames: string[] = [];

    for (let i = 0; i < queue.length; i++) {
      const success = await onUploadFile({
        file: queue[i],
        fileType: 'material',
        ...uploadSlugs,
      });
      if (success) {
        uploadedNames.push(queue[i].name);
      } else {
        remaining.push(...queue.slice(i));
        break;
      }
    }

    if (uploadedNames.length > 0) {
      await onMaterialsUploaded(uploadedNames);
    }

    setPendingFiles(remaining);
  };

  const handleCreateGoogleDoc = async () => {
    const title = materialDocTitle.trim();
    if (!title) return;
    const success = await onCreateGoogleDocMaterial({ title });
    if (success) {
      setMaterialDocTitle('');
      setIsCreatingDoc(false);
      await onMaterialsUploaded([`${title} (Google Doc)`]);
    }
  };

  const canDeleteFile = (file: ClassFile) =>
    isAdmin || file.uploaderId === currentUser.id;

  const isBusy = saving;

  return (
    <div className="space-y-8">
      <section className="bg-white rounded-lg shadow border border-gray-200 p-6 space-y-6">
        <h3 className="text-lg font-semibold text-gray-900">
          Session Notes &amp; Materials
        </h3>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-base font-medium text-gray-800">Text Notes</h4>
            {canManageNotes && !isAddingNote && (
              <button
                type="button"
                onClick={() => setIsAddingNote(true)}
                disabled={isBusy}
                className="flex items-center gap-1.5 text-sm text-amber-700 hover:text-amber-900 font-medium disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                Add Note
              </button>
            )}
          </div>

          {isAddingNote && (
            <div className="mb-4 p-4 rounded-lg border border-amber-200 bg-amber-50 space-y-3">
              <input
                type="text"
                value={newNoteTitle}
                onChange={e => setNewNoteTitle(e.target.value)}
                placeholder="Title (optional)"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <textarea
                value={newNoteContent}
                onChange={e => setNewNoteContent(e.target.value)}
                rows={4}
                placeholder="Note content..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAddNote}
                  disabled={isBusy || !newNoteContent.trim()}
                  className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingNote(false);
                    setNewNoteTitle('');
                    setNewNoteContent('');
                  }}
                  disabled={isBusy}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {studentNotes.length === 0 ? (
            <p className="text-sm text-gray-500">No notes yet.</p>
          ) : (
            <div className="space-y-3">
              {studentNotes.map(note => (
                <div
                  key={note.id}
                  className="p-4 rounded-lg border border-gray-200"
                >
                  {editingNoteId === note.id ? (
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={editNoteTitle}
                        onChange={e => setEditNoteTitle(e.target.value)}
                        placeholder="Title (optional)"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      <textarea
                        value={editNoteContent}
                        onChange={e => setEditNoteContent(e.target.value)}
                        rows={4}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleSaveNote(note.id)}
                          disabled={isBusy || !editNoteContent.trim()}
                          className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditNote}
                          disabled={isBusy}
                          className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          {note.title && (
                            <h5 className="font-medium text-gray-900 mb-1">
                              {note.title}
                            </h5>
                          )}
                          <p className="text-gray-700 whitespace-pre-wrap">
                            {note.content}
                          </p>
                          <p className="text-sm text-gray-500 mt-2">
                            {note.authorName} · {formatDate(note.createdAt)}
                          </p>
                        </div>
                        {canManageNotes && (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => startEditNote(note)}
                              disabled={isBusy}
                              className="p-1.5 text-gray-400 hover:text-amber-600 rounded-md hover:bg-gray-100 disabled:opacity-50"
                              aria-label="Edit note"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteNote(note.id)}
                              disabled={isBusy}
                              className="p-1.5 text-gray-400 hover:text-red-600 rounded-md hover:bg-gray-100 disabled:opacity-50"
                              aria-label="Delete note"
                            >
                              <Trash className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 pt-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-base font-medium text-gray-800">
              Uploaded Materials
            </h4>
            {canManageNotes && (
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <button
                  type="button"
                  onClick={() => setIsCreatingDoc(true)}
                  disabled={isBusy}
                  className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                >
                  <FileText className="w-4 h-4" />
                  New Google Doc
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isBusy}
                  className="flex items-center gap-1.5 bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  Select Files
                </button>
              </div>
            )}
          </div>

          {canManageNotes && isCreatingDoc && (
            <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-end">
                <div className="min-w-0 flex-1">
                  <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">
                    Material document
                  </label>
                  <input
                    type="text"
                    value={materialDocTitle}
                    onChange={event => setMaterialDocTitle(event.target.value)}
                    placeholder="Document title"
                    className="mt-2 w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="mt-2 text-xs text-blue-700">
                    Saved under {getCourseDisplayName(selectedCourse)} / Materials / {selectedSubject.title}.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCreateGoogleDoc}
                    disabled={isBusy || !materialDocTitle.trim()}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    Create
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingDoc(false);
                      setMaterialDocTitle('');
                    }}
                    disabled={isBusy}
                    className="rounded-lg px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {canManageNotes && pendingFiles.length > 0 && (
            <div className="mb-4 p-4 rounded-lg border border-amber-200 bg-amber-50 space-y-3">
              <p className="text-sm font-medium text-gray-800">
                Ready to upload ({pendingFiles.length})
              </p>
              <ul className="space-y-2">
                {pendingFiles.map((file, index) => {
                  const PendingIcon = getFileIcon(file.type || null);
                  return (
                    <li
                      key={`${file.name}-${file.size}-${index}`}
                      className="flex items-center justify-between gap-3 p-2 rounded-md bg-white border border-amber-100"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <PendingIcon className="w-4 h-4 text-amber-600 flex-shrink-0" />
                        <span className="text-sm text-gray-700 truncate">
                          {file.name} · {formatFileSize(file.size)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemovePending(index)}
                        disabled={isBusy}
                        className="p-1 text-gray-400 hover:text-red-600 rounded-md hover:bg-gray-100 disabled:opacity-50 flex-shrink-0"
                        aria-label={`Remove ${file.name}`}
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleConfirmUpload}
                  disabled={isBusy}
                  className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
                >
                  Upload
                </button>
                <button
                  type="button"
                  onClick={handleCancelPending}
                  disabled={isBusy}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {files.length === 0 ? (
            <p className="text-sm text-gray-500">No materials uploaded yet.</p>
          ) : (
            <div className="space-y-3">
              {files.map(file => {
                const FileIcon = getFileIcon(file.mimeType);
                return (
                  <div
                    key={file.id}
                    className="flex items-center justify-between gap-4 p-4 rounded-lg border border-gray-200"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                        <FileIcon className="w-5 h-5 text-amber-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {file.fileName}
                        </p>
                        <p className="text-sm text-gray-500">
                          {file.uploaderName} · {formatDate(file.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {(() => {
                        const preview = resolveClassFilePreview(file);
                        return preview ? (
                          <button
                            type="button"
                            onClick={() => setPreviewItem(preview)}
                            className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-700 hover:bg-amber-100"
                          >
                            Preview
                          </button>
                        ) : null;
                      })()}
                      <button
                        type="button"
                        onClick={() => window.open(file.driveViewUrl, '_blank')}
                        className="flex items-center gap-1.5 text-sm text-amber-700 hover:text-amber-900 font-medium"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Open
                      </button>
                      {canDeleteFile(file) && (
                        <button
                          type="button"
                          onClick={() => onDeleteFile(file)}
                          disabled={isBusy}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded-md hover:bg-gray-100 disabled:opacity-50"
                          aria-label="Delete file"
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
      <FilePreviewModal item={previewItem} onClose={() => setPreviewItem(null)} />
    </div>
  );
}
