import React, { createContext, useContext, useState } from 'react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks

interface UploadTask {
  id: string;
  title: string;
  progress: number;
  status: 'uploading' | 'completed' | 'failed';
}

interface UploadContextType {
  tasks: UploadTask[];
  startUpload: (file: File, metadata: any) => Promise<void>;
}

const UploadContext = createContext<UploadContextType | undefined>(undefined);

export const UploadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tasks, setTasks] = useState<UploadTask[]>([]);

  const updateTask = (id: string, updates: Partial<UploadTask>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const startUpload = async (file: File, metadata: any) => {
    const videoId = file.name.split('.')[0].toLowerCase().replace(/\s+/g, '_').replace(/[^\w]/g, '');
    const taskId = `${Date.now()}-${videoId}`;
    const tenantId = 'GLOBAL';
    const s3Key = `${tenantId}/${metadata.familyId}/${file.name}`;

    setTasks(prev => [...prev, { id: taskId, title: metadata.title, progress: 0, status: 'uploading' }]);

    try {
      // 1. Create Ingest record as 'UPLOADING'
      await axios.post(`${API_BASE_URL}ingest`, {
        ...metadata,
        videoId,
        videoFileName: file.name,
        status: 'UPLOADING'
      }, { headers: { 'x-tenant-id': tenantId } });

      // 2. Start Multipart
      const startRes = await axios.post(`${API_BASE_URL}upload/start`, { key: s3Key, contentType: file.type });
      const { uploadId } = startRes.data;

      // 3. Slice and Upload Chunks
      const totalParts = Math.ceil(file.size / CHUNK_SIZE);
      const completedParts = [];

      for (let i = 0; i < totalParts; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const partNumber = i + 1;
        const blob = file.slice(start, end);

        // Lead Strategy: Pass totalParts for improved backend observability
        const urlRes = await axios.post(`${API_BASE_URL}upload/part`, {
            key: s3Key,
            uploadId,
            partNumber,
            totalParts
        });
        const { uploadUrl } = urlRes.data;

        const partRes = await axios.put(uploadUrl, blob);
        // Senior Strategy: Handle ETag header safely.
        // Browsers/Axios might return it as 'etag' or 'ETag'.
        const eTag = partRes.headers.etag || partRes.headers.ETag;

        if (!eTag) {
          throw new Error(`Part ${partNumber} upload failed: No ETag returned from S3. Check CORS exposeHeaders.`);
        }

        completedParts.push({ ETag: eTag, PartNumber: partNumber });
        updateTask(taskId, { progress: Math.round((partNumber / totalParts) * 100) });
      }

      // 4. Complete Multipart
      await axios.post(`${API_BASE_URL}upload/complete`, { key: s3Key, uploadId, parts: completedParts });
      updateTask(taskId, { status: 'completed', progress: 100 });

    } catch (err) {
      console.error('Upload failed:', err);
      updateTask(taskId, { status: 'failed' });
    }
  };

  return (
    <UploadContext.Provider value={{ tasks, startUpload }}>
      {children}
    </UploadContext.Provider>
  );
};

export const useUpload = () => {
  const context = useContext(UploadContext);
  if (!context) throw new Error('useUpload must be used within UploadProvider');
  return context;
};
