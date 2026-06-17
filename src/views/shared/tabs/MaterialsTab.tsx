import { useState, useEffect, useCallback, useRef } from 'react';
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
import { supabase } from '../../../lib/supabase';
import type { ClassNote, ClassFile, SubjectNote, User, Course, Subject, Class } from '../../../types/lms';
import { hasRole } from '../../../utils/userUtils';
import { getCourseDisplayName } from '../../../utils/courseUtils';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';

interface MaterialsTabProps {
  classId: number;
  subjectId: number;
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
  }) => Promise<void>;
  onDeleteFile: (file: ClassFile) => Promise<void>;
  selectedCourse: Course;
  selectedSubject: Subject;
  selectedClass: Class;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getFileIcon(mimeType: string | null): LucideIcon {
  if (mimeType?.startsWith('image/')) return Image;
  if (mimeType?.includes('pdf')) return FileText;
  if (mimeType?.includes('video')) return FileVideo;
  return FileIcon;
}

function useSubjectCurriculumPlan(subjectId: number, currentUser: User) {
  const [plan, setPlan] = useState<SubjectNote | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchPlan = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('subject_notes')
        .select('*, author:profiles!author_id(id, name)')
        .eq('subject_id', subjectId)
        .eq('note_type', 'curriculum_plan')
        .maybeSingle();

      if (error) throw error;

      setPlan(
        data
          ? {
              id: data.id,
              subjectId: data.subject_id,
              authorId: data.author_id,
              authorName: data.author?.name ?? 'Unknown',
              noteType: data.note_type,
              title: data.title,
              content: data.content,
              createdAt: data.created_at,
              updatedAt: data.updated_at,
            }
          : null
      );
    } catch (err) {
      console.error('Failed to load curriculum plan:', err);
    } finally {
      setLoading(false);
    }
  }, [subjectId]);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  const saveCurriculumPlan = async (content: string) => {
    setSaving(true);
    try {
      if (plan) {
        const { error } = await supabase
          .from('subject_notes')
          .update({
            content,
            updated_at: new Date().toISOString(),
          })
          .eq('id', plan.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('subject_notes').insert({
          subject_id: subjectId,
          author_id: currentUser.id,
          note_type: 'curriculum_plan',
          title: null,
          content,
        });
        if (error) throw error;
      }
      await fetchPlan();
    } catch (err) {
      console.error('Failed to save curriculum plan:', err);
    } finally {
      setSaving(false);
    }
  };

  return { plan, loading, saving, saveCurriculumPlan };
}

export function MaterialsTab({
  subjectId,
  currentUser,
  notes,
  files,
  saving,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
  onUploadFile,
  onDeleteFile,
  selectedCourse,
  selectedSubject,
  selectedClass,
}: MaterialsTabProps) {
  const canEditCurriculum =
    hasRole(currentUser, 'administrator') || hasRole(currentUser, 'teacher');
  const canManageNotes =
    hasRole(currentUser, 'administrator') || hasRole(currentUser, 'teacher');
  const isAdmin = hasRole(currentUser, 'administrator');

  const { plan, loading: planLoading, saving: planSaving, saveCurriculumPlan } =
    useSubjectCurriculumPlan(subjectId, currentUser);

  const [isEditingPlan, setIsEditingPlan] = useState(false);
  const [planDraft, setPlanDraft] = useState('');

  const [isAddingNote, setIsAddingNote] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editNoteTitle, setEditNoteTitle] = useState('');
  const [editNoteContent, setEditNoteContent] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const studentNotes = notes.filter(n => n.noteType === 'student_note');

  const showCurriculumSection = canEditCurriculum || !!plan;

  const startEditPlan = () => {
    setPlanDraft(plan?.content ?? '');
    setIsEditingPlan(true);
  };

  const cancelEditPlan = () => {
    setIsEditingPlan(false);
    setPlanDraft('');
  };

  const handleSavePlan = async () => {
    const content = planDraft.trim();
    if (!content) return;
    await saveCurriculumPlan(content);
    setIsEditingPlan(false);
    setPlanDraft('');
  };

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await onUploadFile({
      file,
      fileType: 'material',
      courseSlug: getCourseDisplayName(selectedCourse)
        .toLowerCase().replace(/\s+/g, '-'),
      subjectSlug: selectedSubject.title
        .toLowerCase().replace(/\s+/g, '-'),
      classSlug: `${selectedClass.date ?? 'no-date'}-${selectedClass.title.toLowerCase().replace(/\s+/g, '-')}`,
    });
    e.target.value = '';
  };

  const canDeleteFile = (file: ClassFile) =>
    isAdmin || file.uploaderId === currentUser.id;

  const isBusy = saving || planSaving;

  return (
    <div className="space-y-8">
      {showCurriculumSection && (
        <section className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Subject Curriculum Plan
            </h3>
            {canEditCurriculum && !isEditingPlan && plan && (
              <button
                type="button"
                onClick={startEditPlan}
                disabled={isBusy}
                className="flex items-center gap-1.5 text-sm text-amber-700 hover:text-amber-900 font-medium disabled:opacity-50"
              >
                <Pencil className="w-4 h-4" />
                Edit
              </button>
            )}
          </div>

          {planLoading ? (
            <LoadingSpinner message="Loading curriculum plan..." />
          ) : isEditingPlan ? (
            <div className="space-y-3">
              <textarea
                value={planDraft}
                onChange={e => setPlanDraft(e.target.value)}
                rows={8}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                placeholder="Enter the subject curriculum plan..."
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSavePlan}
                  disabled={isBusy || !planDraft.trim()}
                  className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={cancelEditPlan}
                  disabled={isBusy}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : plan ? (
            <div>
              <p className="text-gray-700 whitespace-pre-wrap">{plan.content}</p>
              <p className="text-sm text-gray-500 mt-3">
                {plan.authorName} · Updated {formatDate(plan.updatedAt)}
              </p>
            </div>
          ) : canEditCurriculum ? (
            <button
              type="button"
              onClick={startEditPlan}
              disabled={isBusy}
              className="flex items-center gap-1.5 bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              Add curriculum plan
            </button>
          ) : null}
        </section>
      )}

      <section className="bg-white rounded-lg shadow border border-gray-200 p-6 space-y-6">
        <h3 className="text-lg font-semibold text-gray-900">
          Class Notes &amp; Materials
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
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isBusy}
                  className="flex items-center gap-1.5 bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  Upload Material
                </button>
              </div>
            )}
          </div>

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
    </div>
  );
}
