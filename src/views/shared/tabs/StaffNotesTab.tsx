import { useState, useRef } from 'react';
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
import type { Class, ClassNote, ClassFile, User, Course, Subject } from '../../../types/lms';
import { hasRole } from '../../../utils/userUtils';
import { getCourseDisplayName } from '../../../utils/courseUtils';
import { formatPlatformDate } from '../../../utils/dateUtils';

interface StaffNotesTabProps {
  currentUser: User;
  notes: ClassNote[];
  files: ClassFile[];
  saving: boolean;
  selectedClass: Class;
  selectedCourse: Course;
  selectedSubject: Subject;
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
    fileType: 'teacher_note' | 'translator_note';
    courseSlug: string;
    subjectSlug: string;
    classSlug: string;
  }) => Promise<void>;
  onDeleteFile: (file: ClassFile) => Promise<void>;
}

interface StaffNotesColumnProps {
  title: string;
  emptyLabel: string;
  noteType: 'teacher_note' | 'translator_note';
  fileType: 'teacher_note' | 'translator_note';
  courseSlug: string;
  subjectSlug: string;
  classSlug: string;
  canManage: boolean;
  notes: ClassNote[];
  files: ClassFile[];
  currentUser: User;
  saving: boolean;
  onAddNote: StaffNotesTabProps['onAddNote'];
  onUpdateNote: StaffNotesTabProps['onUpdateNote'];
  onDeleteNote: StaffNotesTabProps['onDeleteNote'];
  onUploadFile: StaffNotesTabProps['onUploadFile'];
  onDeleteFile: StaffNotesTabProps['onDeleteFile'];
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

function StaffNotesColumn({
  title,
  emptyLabel,
  noteType,
  fileType,
  courseSlug,
  subjectSlug,
  classSlug,
  canManage,
  notes,
  files,
  currentUser,
  saving,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
  onUploadFile,
  onDeleteFile,
}: StaffNotesColumnProps) {
  const isAdmin = hasRole(currentUser, 'administrator');

  const [isAddingNote, setIsAddingNote] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editNoteTitle, setEditNoteTitle] = useState('');
  const [editNoteContent, setEditNoteContent] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const columnNotes = notes.filter(n => n.noteType === noteType);
  const columnFiles = files.filter(f => f.fileType === fileType);
  const isEmpty = columnNotes.length === 0 && columnFiles.length === 0;

  const canEditNote = (note: ClassNote) =>
    isAdmin || note.authorId === currentUser.id;

  const canDeleteFile = (file: ClassFile) =>
    isAdmin || file.uploaderId === currentUser.id;

  const handleAddNote = async () => {
    const content = newNoteContent.trim();
    if (!content) return;
    await onAddNote({
      noteType,
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await onUploadFile({
      file,
      fileType,
      courseSlug,
      subjectSlug,
      classSlug,
    });
    e.target.value = '';
  };

  return (
    <section className="bg-white rounded-lg shadow border border-gray-200 p-6 space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-base font-medium text-gray-800">Text Notes</h4>
          {canManage && !isAddingNote && (
            <button
              type="button"
              onClick={() => setIsAddingNote(true)}
              disabled={saving}
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
                disabled={saving || !newNoteContent.trim()}
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
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {columnNotes.length === 0 && isEmpty && (
          <p className="text-sm text-gray-500">{emptyLabel}</p>
        )}

        {columnNotes.length > 0 && (
          <div className="space-y-3">
            {columnNotes.map(note => (
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
                        disabled={saving || !editNoteContent.trim()}
                        className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditNote}
                        disabled={saving}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
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
                    {canEditNote(note) && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => startEditNote(note)}
                          disabled={saving}
                          className="p-1.5 text-gray-400 hover:text-amber-600 rounded-md hover:bg-gray-100 disabled:opacity-50"
                          aria-label="Edit note"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteNote(note.id)}
                          disabled={saving}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded-md hover:bg-gray-100 disabled:opacity-50"
                          aria-label="Delete note"
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-gray-100 pt-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-base font-medium text-gray-800">Uploaded Files</h4>
          {canManage && (
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileUpload}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={saving}
                className="flex items-center gap-1.5 bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                Upload File
              </button>
            </div>
          )}
        </div>

        {columnFiles.length > 0 && (
          <div className="space-y-3">
            {columnFiles.map(file => {
              const MimeIcon = getFileIcon(file.mimeType);
              return (
                <div
                  key={file.id}
                  className="flex items-center justify-between gap-4 p-4 rounded-lg border border-gray-200"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                      <MimeIcon className="w-5 h-5 text-amber-600" />
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
                        disabled={saving}
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
  );
}

export function StaffNotesTab({
  currentUser,
  notes,
  files,
  saving,
  selectedClass,
  selectedCourse,
  selectedSubject,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
  onUploadFile,
  onDeleteFile,
}: StaffNotesTabProps) {
  const canManageTeacherNotes =
    hasRole(currentUser, 'administrator') || hasRole(currentUser, 'teacher');
  const canManageTranslatorNotes =
    hasRole(currentUser, 'administrator') || hasRole(currentUser, 'translator');

  const courseSlug = getCourseDisplayName(selectedCourse)
    .toLowerCase().replace(/\s+/g, '-');
  const subjectSlug = selectedSubject.title
    .toLowerCase().replace(/\s+/g, '-');
  const classSlug = `${selectedClass.date ?? 'no-date'}-${selectedClass.title.toLowerCase().replace(/\s+/g, '-')}`;

  const sharedColumnProps = {
    currentUser,
    saving,
    courseSlug,
    subjectSlug,
    classSlug,
    onAddNote,
    onUpdateNote,
    onDeleteNote,
    onUploadFile,
    onDeleteFile,
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <StaffNotesColumn
        title="Teacher Notes"
        emptyLabel="No teacher notes yet."
        noteType="teacher_note"
        fileType="teacher_note"
        canManage={canManageTeacherNotes}
        notes={notes}
        files={files}
        {...sharedColumnProps}
      />
      <StaffNotesColumn
        title="Translator Notes"
        emptyLabel="No translator notes yet."
        noteType="translator_note"
        fileType="translator_note"
        canManage={canManageTranslatorNotes}
        notes={notes}
        files={files}
        {...sharedColumnProps}
      />
    </div>
  );
}
