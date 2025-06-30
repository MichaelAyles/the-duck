import { supabase } from '@/lib/supabase';
import type { FileUpload, FileUploadResponse } from '@/types/file-upload';
import { MAX_FILE_SIZE, isAllowedFileType } from '@/types/file-upload';
import { logger } from '@/lib/logger';

export class FileUploadService {
  private supabase = supabase;

  async uploadFile(
    file: File,
    userId: string,
    sessionId?: string,
    // onProgress?: (progress: { loaded: number; total: number; percentage: number }) => void
  ): Promise<FileUploadResponse> {
    try {
      if (!this.supabase) {
        return {
          success: false,
          error: 'Supabase is not configured',
        };
      }
      // Validate file type
      if (!isAllowedFileType(file.type)) {
        return {
          success: false,
          error: `File type ${file.type} is not allowed`,
        };
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        return {
          success: false,
          error: `File size exceeds the maximum limit of 10MB`,
        };
      }

      // Generate storage path: userId/timestamp-filename
      const timestamp = Date.now();
      const fileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_'); // Sanitize filename
      const storagePath = `${userId}/${timestamp}-${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await this.supabase.storage
        .from('chat-uploads')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        logger.error('Upload error:', uploadError);
        return {
          success: false,
          error: uploadError.message || 'Failed to upload file to storage',
        };
      }

      // Create file record in database via API
      const response = await fetch('/api/files', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file_name: file.name,
          file_type: file.type.split('/')[1] || 'unknown',
          file_size: file.size,
          storage_path: storagePath,
          mime_type: file.type,
          session_id: sessionId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        // Clean up the uploaded file from storage if metadata save fails
        try {
          await this.supabase?.storage
            .from('chat-uploads')
            .remove([storagePath]);
        } catch (cleanupError) {
          logger.dev.log('Failed to cleanup uploaded file:', cleanupError);
        }
        throw new Error(error.error || 'Failed to save file metadata');
      }

      const fileUpload: FileUpload = await response.json();

      // Get signed URL for the file
      const { data: urlData } = await this.supabase.storage
        .from('chat-uploads')
        .createSignedUrl(storagePath, 3600); // 1 hour expiry

      return {
        success: true,
        fileUpload,
        url: urlData?.signedUrl,
      };
    } catch (error) {
      logger.error('File upload error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to upload file',
      };
    }
  }

  async getFileUrl(storagePath: string): Promise<string | null> {
    if (!this.supabase) return null;
    
    const { data } = await this.supabase.storage
      .from('chat-uploads')
      .createSignedUrl(storagePath, 3600); // 1 hour expiry

    return data?.signedUrl || null;
  }

  async deleteFile(fileId: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/files/${fileId}`, {
        method: 'DELETE',
      });

      return response.ok;
    } catch (error) {
      logger.error('File deletion error:', error);
      return false;
    }
  }

  async getUserStorageUsage(): Promise<{
    totalSize: number;
    fileCount: number;
    remainingSpace: number;
  } | null> {
    try {
      const response = await fetch('/api/files/usage');
      if (!response.ok) return null;

      const data = await response.json();
      return {
        totalSize: data.total_size,
        fileCount: data.file_count,
        remainingSpace: MAX_FILE_SIZE * 100 - data.total_size, // 1GB total limit
      };
    } catch (error) {
      logger.error('Failed to get storage usage:', error);
      return null;
    }
  }
}