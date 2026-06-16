import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { uploadFileToDrive, deleteFileFromDrive } from '../utils/driveOperations';
import type { User } from '../types/lms';

export interface ClassFile {
  id: number;
  classId: number;
  uploaderId: string;
  uploaderName: string;
  fileType: 'material' | 'homework' | 'teacher_note' | 'translator_note';
  fileName: string;
  driveFileId: string;
  driveViewUrl: string;
  mimeType: string | null;
  fileSize: number | null;
  createdAt: string;
}

export function useClassFiles(classId: number | null) {
  const [files, setFiles] = useState<ClassFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFiles = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('class_files')
        .select(`
          *,
          uploader:profiles!uploader_id (id, name)
        `)
        .eq('class_id', classId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setFiles((data ?? []).map(row => ({
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
      setError('Failed to load files');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const uploadFile = async (params: {
    file: File;
    fileType: ClassFile['fileType'];
    targetFolderId: string;
    currentUser: User;
    classId: number;
    studentName?: string;
  }): Promise<void> => {
    setUploading(true);
    setError(null);
    try {
      // Convert File to base64
      const arrayBuffer = await params.file.arrayBuffer();
      const base64 = btoa(
        String.fromCharCode(...new Uint8Array(arrayBuffer))
      );

      // Upload to Drive
      const { driveFileId, driveViewUrl } = await uploadFileToDrive({
        fileName: params.file.name,
        mimeType: params.file.type || 'application/octet-stream',
        fileBase64: base64,
        targetFolderId: params.targetFolderId,
        studentName: params.studentName,
      });

      // Save metadata to Supabase
      const { error } = await supabase.from('class_files').insert({
        class_id: params.classId,
        uploader_id: params.currentUser.id,
        file_type: params.fileType,
        file_name: params.file.name,
        drive_file_id: driveFileId,
        drive_view_url: driveViewUrl,
        mime_type: params.file.type || null,
        file_size: params.file.size,
      });

      if (error) throw error;
      await fetchFiles();
    } catch (err) {
      setError('Upload failed. Please try again.');
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const deleteFile = async (file: ClassFile): Promise<void> => {
    try {
      await deleteFileFromDrive(file.driveFileId);
      await supabase.from('class_files').delete().eq('id', file.id);
      await fetchFiles();
    } catch (err) {
      setError('Delete failed.');
      console.error(err);
    }
  };

  return { files, loading, uploading, error, uploadFile, deleteFile };
}
