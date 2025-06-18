'use client';
/* eslint-disable jsx-a11y/alt-text */

import React, { useCallback, useState, useMemo } from 'react';
import { Upload, X, File, Image, FileText, Archive } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { FileUploadService } from '@/lib/file-upload-service';
import { formatFileSize, getFileExtensions, MAX_FILE_SIZE } from '@/types/file-upload';
import type { FileUpload, FileUploadProgress } from '@/types/file-upload';

interface FileUploadComponentProps {
  sessionId?: string;
  userId?: string;
  onFileUploaded?: (file: FileUpload, url: string) => void;
  className?: string;
}

export const FileUploadComponent: React.FC<FileUploadComponentProps> = ({
  sessionId: _sessionId, // eslint-disable-line @typescript-eslint/no-unused-vars
  userId,
  onFileUploaded,
  className,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<FileUploadProgress | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();
  const fileUploadService = useMemo(() => new FileUploadService(), []);

  const handleFileSelect = useCallback((file: File) => {
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: 'File too large',
        description: `File size must be less than ${formatFileSize(MAX_FILE_SIZE)}`,
        variant: 'destructive',
      });
      return;
    }

    setSelectedFile(file);
  }, [toast]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleUpload = useCallback(async () => {
    if (!selectedFile || !userId) return;

    setIsUploading(true);
    setUploadProgress({ loaded: 0, total: selectedFile.size, percentage: 0 });

    try {
      // Don't pass sessionId during upload if session doesn't exist yet
      // The session will be linked when the first message is sent
      const result = await fileUploadService.uploadFile(
        selectedFile,
        userId,
        undefined // Don't pass sessionId during upload to avoid foreign key errors
      );

      if (result.success && result.fileUpload && result.url) {
        toast({
          title: 'File uploaded',
          description: `${selectedFile.name} uploaded successfully`,
        });
        onFileUploaded?.(result.fileUpload, result.url);
        setSelectedFile(null);
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Failed to upload file',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  }, [selectedFile, userId, fileUploadService, onFileUploaded, toast]);

  const getFileIcon = (file: File) => {
    const type = file.type.split('/')[0];
    switch (type) {
      case 'image':
        return <Image className="w-4 h-4" />;
      case 'text':
      case 'application':
        if (file.type.includes('pdf') || file.type.includes('document')) {
          return <FileText className="w-4 h-4" />;
        }
        if (file.type.includes('zip') || file.type.includes('tar') || file.type.includes('gzip')) {
          return <Archive className="w-4 h-4" />;
        }
        return <File className="w-4 h-4" />;
      default:
        return <File className="w-4 h-4" />;
    }
  };

  return (
    <div className={cn('relative', className)}>
      {/* File input */}
      <input
        type="file"
        id="file-upload"
        className="hidden"
        accept={getFileExtensions().join(',')}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileSelect(file);
        }}
      />

      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'border-2 border-dashed rounded-lg p-4 transition-colors',
          isDragging ? 'border-primary bg-primary/5' : 'border-border',
          selectedFile && 'bg-muted/50'
        )}
      >
        {selectedFile ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getFileIcon(selectedFile)}
                <div>
                  <p className="text-sm font-medium">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedFile(null)}
                disabled={isUploading}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {uploadProgress && (
              <div className="space-y-1">
                <Progress value={uploadProgress.percentage} />
                <p className="text-xs text-muted-foreground text-center">
                  {uploadProgress.percentage}%
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleUpload}
                disabled={isUploading}
                className="flex-1"
              >
                {isUploading ? 'Uploading...' : 'Upload'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setSelectedFile(null)}
                disabled={isUploading}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <label
            htmlFor="file-upload"
            className="flex flex-col items-center justify-center py-4 cursor-pointer"
          >
            <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-1">
              Drop files here or click to upload
            </p>
            <p className="text-xs text-muted-foreground">
              Max size: {formatFileSize(MAX_FILE_SIZE)}
            </p>
          </label>
        )}
      </div>
    </div>
  );
};