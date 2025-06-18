'use client';
/* eslint-disable @next/next/no-img-element */
/* eslint-disable jsx-a11y/alt-text */

import React, { useState } from 'react';
import { Download, Eye, Trash2, File, Image, FileText, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatFileSize } from '@/types/file-upload';
import type { FileUpload } from '@/types/file-upload';
import { FileUploadService } from '@/lib/file-upload-service';
import { useToast } from '@/hooks/use-toast';

interface FilePreviewProps {
  file: FileUpload;
  url?: string;
  onDelete?: (fileId: string) => void;
  className?: string;
  compact?: boolean;
}

export const FilePreview: React.FC<FilePreviewProps> = ({
  file,
  url,
  onDelete,
  className,
  compact = false,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(url);
  const { toast } = useToast();
  const fileUploadService = new FileUploadService();

  const getFileIcon = () => {
    if (!file.mime_type) {
      return <File className="w-4 h-4" />;
    }
    const type = file.mime_type.split('/')[0];
    switch (type) {
      case 'image':
        return <Image className="w-4 h-4" />;
      case 'text':
      case 'application':
        if (file.mime_type?.includes('pdf') || file.mime_type?.includes('document')) {
          return <FileText className="w-4 h-4" />;
        }
        if (file.mime_type?.includes('zip') || file.mime_type?.includes('tar') || file.mime_type?.includes('gzip')) {
          return <Archive className="w-4 h-4" />;
        }
        return <File className="w-4 h-4" />;
      default:
        return <File className="w-4 h-4" />;
    }
  };

  const handleView = async () => {
    if (previewUrl) {
      window.open(previewUrl, '_blank');
    } else {
      // Generate a new signed URL if needed
      const newUrl = await fileUploadService.getFileUrl(file.storage_path);
      if (newUrl) {
        setPreviewUrl(newUrl);
        window.open(newUrl, '_blank');
      } else {
        toast({
          title: 'Failed to open file',
          description: 'Could not generate file URL',
          variant: 'destructive',
        });
      }
    }
  };

  const handleDownload = async () => {
    const downloadUrl = previewUrl || await fileUploadService.getFileUrl(file.storage_path);
    if (downloadUrl) {
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = file.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      toast({
        title: 'Failed to download file',
        description: 'Could not generate download URL',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (isDeleting) return;

    setIsDeleting(true);
    try {
      const success = await fileUploadService.deleteFile(file.id);
      if (success) {
        toast({
          title: 'File deleted',
          description: 'File has been removed successfully',
        });
        onDelete?.(file.id);
      } else {
        throw new Error('Failed to delete file');
      }
    } catch (error) {
      toast({
        title: 'Failed to delete file',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (compact) {
    return (
      <div className={cn('inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/50', className)}>
        {getFileIcon()}
        <span className="text-sm font-medium">{file.file_name}</span>
        <span className="text-xs text-muted-foreground">({formatFileSize(file.file_size)})</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleView}
        >
          <Eye className="w-3 h-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className={cn('border rounded-lg p-4', className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="p-2 rounded-md bg-muted">
            {getFileIcon()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{file.file_name}</p>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(file.file_size)} • {new Date(file.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleView}
            title="View file"
          >
            <Eye className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDownload}
            title="Download file"
          >
            <Download className="w-4 h-4" />
          </Button>
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDelete}
              disabled={isDeleting}
              title="Delete file"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Image preview for image files */}
      {file.mime_type?.startsWith('image/') && previewUrl && (
        <div className="mt-3">
          <img
            src={previewUrl}
            alt={file.file_name}
            className="rounded-md max-h-48 object-contain"
          />
        </div>
      )}
    </div>
  );
};