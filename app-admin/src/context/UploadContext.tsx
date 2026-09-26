/**
 * ============================================================================
 * Demetrius Resumable Multipart Upload Context & Queue Manager
 * ============================================================================
 * Enterprise Architecture Strategy: Resumable Background Multipart Uploader.
 * Manages chunked S3 uploads (10MB parts) with persistent localStorage state,
 * enabling full upload resumption across browser restarts without re-uploading parts.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import api from '../api';

const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks

interface CompletedPart {
  ETag: string;
  PartNumber: number;
}

interface UploadTask {
  id: string;
  title: string;
  progress: number;
  status: 'uploading' | 'completed' | 'failed' | 'interrupted';
  uploadId?: string;
  s3Key?: string;
  fileName?: string;
  fileSize?: number;
  completedParts: CompletedPart[];
}

interface UploadContextType {
  tasks: UploadTask[];
  startUpload: (file: File, metadata: any) => Promise<void>;
  resumeUpload: (taskId: string, file: File) => Promise<void>;
  removeTask: (taskId: string) => void;
  clearTasks: () => void;
}

const UploadContext = createContext<UploadContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'alexandria_upload_tasks';

export const UploadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tasks, setTasks] = useState<UploadTask[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!saved) return [];

    const parsed: UploadTask[] = JSON.parse(saved);
    // Interruption Detection: Any task that was 'uploading' when tab closed is marked 'interrupted'
    return parsed.map(t => t.status === 'uploading' ? { ...t, status: 'interrupted' } : t);
  });

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  const updateTask = (id: string, updates: Partial<UploadTask>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const removeTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const clearTasks = () => {
    setTasks(prev => prev.filter(t => t.status === 'uploading'));
  };

  /**
   * Handles both fresh and resumed uploads by checking completedParts.
   */
  const performMultipartUpload = async (taskId: string, file: File, uploadId: string, s3Key: string, existingParts: CompletedPart[]) => {
    const totalParts = Math.ceil(file.size / CHUNK_SIZE);
    const completedParts = [...existingParts];

    try {
      updateTask(taskId, { status: 'uploading' });

      for (let i = 0; i < totalParts; i++) {
        const partNumber = i + 1;

        if (completedParts.some(p => p.PartNumber === partNumber)) {
            continue;
        }

        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const blob = file.slice(start, end);

        const urlRes = await api.post('upload/part', {
            key: s3Key,
            uploadId,
            partNumber,
            totalParts
        });
        const { uploadUrl } = urlRes.data;

        const partRes = await axios.put(uploadUrl, blob);
        const eTag = partRes.headers.etag || partRes.headers.ETag;

        if (!eTag) {
          throw new Error(`Part ${partNumber} upload failed: No ETag returned.`);
        }

        completedParts.push({ ETag: eTag, PartNumber: partNumber });

        updateTask(taskId, {
            progress: Math.round((completedParts.length / totalParts) * 100),
            completedParts
        });
      }

      await api.post('upload/complete', { key: s3Key, uploadId, parts: completedParts });
      updateTask(taskId, { status: 'completed', progress: 100 });

    } catch (err) {
      console.error('Multipart upload loop failed:', err);
      updateTask(taskId, { status: 'failed' });
    }
  };

  const startUpload = async (file: File, metadata: any) => {
    const videoId = file.name.split('.')[0].toLowerCase().replace(/\s+/g, '_').replace(/[^\w]/g, '');
    const taskId = `${Date.now()}-${videoId}`;

    const newTask: UploadTask = {
        id: taskId,
        title: metadata.title,
        progress: 0,
        status: 'uploading',
        fileName: file.name,
        fileSize: file.size,
        completedParts: []
    };

    setTasks(prev => [...prev, newTask]);

    try {
      // 1. Database Lock
      const ingestRes = await api.post('ingest', {
        ...metadata,
        videoId,
        videoFileName: file.name,
        status: 'UPLOADING'
      });
      const s3Key = ingestRes.data?.videoKey;
      if (typeof s3Key !== 'string' || !s3Key) {
        throw new Error('Ingestion API did not return the canonical S3 video key.');
      }
      updateTask(taskId, { s3Key });

      // 2. S3 Handshake
      const startRes = await api.post('upload/start', { key: s3Key, contentType: file.type });
      const { uploadId } = startRes.data;

      updateTask(taskId, { uploadId });

      // 3. Enter Loop
      await performMultipartUpload(taskId, file, uploadId, s3Key, []);

    } catch (err) {
      console.error('Initial upload start failed:', err);
      updateTask(taskId, { status: 'failed' });
    }
  };

  const resumeUpload = async (taskId: string, file: File) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.uploadId || !task.s3Key) return;

    if (file.name !== task.fileName || file.size !== task.fileSize) {
        alert("Selection Mismatch: The selected file does not match the original upload. Please select the correct file to resume.");
        return;
    }

    await performMultipartUpload(taskId, file, task.uploadId, task.s3Key, task.completedParts);
  };

  return (
    <UploadContext.Provider value={{ tasks, startUpload, resumeUpload, removeTask, clearTasks }}>
      {children}
    </UploadContext.Provider>
  );
};

export const useUpload = () => {
  const context = useContext(UploadContext);
  if (!context) throw new Error('useUpload must be used within UploadProvider');
  return context;
};
