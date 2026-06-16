import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { ClassNote, ClassFile, User } from '../types/lms';
import { uploadFileToDrive, deleteFileFromDrive } from '../utils/driveOperations';

export function useClassContent(classId: number | null, currentUser: User) {
  const [notes, setNotes] = useState<ClassNote[]>([]);
  const [files, setFiles] = useState<ClassFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchContent = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    try {
      const { data: notesData, error: notesError } = await supabase
        .from('class_notes')
        .select('*, author:profiles!author_id(id, name)')
        .eq('class_id', classId)
        .order('created_at', { ascending: false });
      if (notesError) throw notesError;

      setNotes((notesData ?? []).map(row => ({
        id: row.id,
        classId: row.class_id,
        authorId: row.author_id,
        authorName: row.author?.name ?? 'Unknown',
        noteType: row.note_type,
        title: row.title,
        content: row.content,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })));

      const { data: filesData, error: filesError } = await supabase
        .from('class_files')
        .select('*, uploader:profiles!uploader_id(id, name)')
        .eq('class_id', classId)
        .order('created_at', { ascending: false });
      if (filesError) throw filesError;

      setFiles((filesData ?? []).map(row => ({
        id: row.id,
        classId: row.class_id,
        uploaderId: row.uploader_id,
        uploaderName: row.uploader?.name ?? 'Unknown',
        fileType: row.file_type,
        fileName: row.file_name,
        driveFileId: row.drive_file_id,
        driveViewUrl: row.drive_view_url,
        mimeType: row.mime_type,
        fileSize: row.file_size,
        createdAt: row.created_at,
      })));
    } catch (err) {
      setError('Failed to load class content');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => { fetchContent(); }, [fetchContent]);

  const addNote = async (data: {
    noteType: ClassNote['noteType'];
    title: string | null;
    content: string;
  }) => {
    if (!classId) return;
    setSaving(true);
    const { error } = await supabase.from('class_notes').insert({
      class_id: classId,
      author_id: currentUser.id,
      note_type: data.noteType,
      title: data.title,
      content: data.content,
    });
    setSaving(false);
    if (error) { setError('Failed to save note'); return; }
    await fetchContent();
  };

  const updateNote = async (id: number, updates: {
    title?: string | null;
    content: string;
  }) => {
    setSaving(true);
    const { error } = await supabase
      .from('class_notes')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    setSaving(false);
    if (error) { setError('Failed to update note'); return; }
    await fetchContent();
  };

  const deleteNote = async (id: number) => {
    const { error } = await supabase
      .from('class_notes').delete().eq('id', id);
    if (error) { setError('Failed to delete note'); return; }
    await fetchContent();
  };

  const uploadFile = async (params: {
    file: File;
    fileType: 'material' | 'teacher_note' | 'translator_note';
    targetFolderId: string;
  }) => {
    setSaving(true);
    setError(null);
    try {
      const arrayBuffer = await params.file.arrayBuffer();
      const base64 = btoa(
        String.fromCharCode(...new Uint8Array(arrayBuffer))
      );
      const { driveFileId, driveViewUrl } = await (
        await import('../utils/driveOperations')
      ).uploadFileToDrive({
        fileName: params.file.name,
        mimeType: params.file.type || 'application/octet-stream',
        fileBase64: base64,
        targetFolderId: params.targetFolderId,
      });

      const { error } = await supabase.from('class_files').insert({
        class_id: classId,
        uploader_id: currentUser.id,
        file_type: params.fileType,
        file_name: params.file.name,
        drive_file_id: driveFileId,
        drive_view_url: driveViewUrl,
        mime_type: params.file.type || null,
        file_size: params.file.size,
      });
      if (error) throw error;
      await fetchContent();
    } catch (err) {
      setError('Upload failed');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const deleteFile = async (file: ClassFile) => {
    try {
      await deleteFileFromDrive(file.driveFileId);
      await supabase.from('class_files').delete().eq('id', file.id);
      await fetchContent();
    } catch (err) {
      setError('Delete failed');
      console.error(err);
    }
  };

  return {
    notes, files, loading, saving, error,
    addNote, updateNote, deleteNote,
    uploadFile, deleteFile,
    refetch: fetchContent,
  };
}
