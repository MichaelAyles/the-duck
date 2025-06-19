"use client";

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Trash2, Download, Eye, FileImage, FileText, File, Loader2, Search, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
// Simple date formatting utility to replace date-fns
const formatDistanceToNow = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
};
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { FileUpload } from '@/types/file-upload';

interface UploadHistoryProps {
  userId?: string;
}

interface UploadHistoryItem extends FileUpload {
  url?: string;
  selected?: boolean;
}

const getFileIcon = (mimeType: string) => {
  if (mimeType.startsWith('image/')) return FileImage;
  if (mimeType.startsWith('text/') || mimeType.includes('document')) return FileText;
  return File;
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export function UploadHistory({ userId }: UploadHistoryProps) {
  const [uploads, setUploads] = useState<UploadHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedUploads, setSelectedUploads] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'size'>('date');
  const [filterType, setFilterType] = useState<'all' | 'image' | 'document'>('all');
  const [totalStorage, setTotalStorage] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const fetchUploads = useCallback(async () => {
    if (!userId) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/uploads/history?userId=${userId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch upload history');
      }
      
      const data = await response.json();
      setUploads(data.uploads || []);
      setTotalStorage(data.totalStorage || 0);
    } catch (error) {
      console.error('Error fetching uploads:', error);
      toast({
        title: "Error",
        description: "Failed to load upload history. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [userId, toast]);

  useEffect(() => {
    fetchUploads();
  }, [fetchUploads]);

  const handleSelectUpload = (uploadId: string, checked: boolean | string) => {
    setSelectedUploads(prev => {
      const newSelected = new Set(prev);
      if (checked) {
        newSelected.add(uploadId);
      } else {
        newSelected.delete(uploadId);
      }
      return newSelected;
    });
  };

  const handleSelectAll = (checked: boolean | string) => {
    if (checked) {
      setSelectedUploads(new Set(filteredUploads.map(upload => upload.id)));
    } else {
      setSelectedUploads(new Set());
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedUploads.size === 0) return;
    
    const confirm = window.confirm(
      `Are you sure you want to delete ${selectedUploads.size} file${selectedUploads.size > 1 ? 's' : ''}? This action cannot be undone.`
    );
    
    if (!confirm) return;
    
    setIsDeleting(true);
    try {
      const response = await fetch('/api/uploads/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uploadIds: Array.from(selectedUploads),
          userId,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete files');
      }
      
      const result = await response.json();
      
      toast({
        title: "Files deleted",
        description: `Successfully deleted ${result.deletedCount} file${result.deletedCount > 1 ? 's' : ''}`,
      });
      
      setSelectedUploads(new Set());
      await fetchUploads(); // Refresh the list
    } catch (error) {
      console.error('Error deleting files:', error);
      toast({
        title: "Error",
        description: "Failed to delete files. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePreviewFile = (upload: UploadHistoryItem) => {
    if (upload.url) {
      window.open(upload.url, '_blank');
    } else {
      const reason = !upload.storage_path 
        ? "File not found in storage" 
        : "Failed to generate preview URL";
      
      toast({
        title: "Preview unavailable",
        description: `${reason}. File: ${upload.file_name}`,
        variant: "destructive",
      });
    }
  };

  const handleDownloadFile = (upload: UploadHistoryItem) => {
    if (upload.url) {
      const link = document.createElement('a');
      link.href = upload.url;
      link.download = upload.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      toast({
        title: "Download unavailable",
        description: "File download is not available for this file.",
        variant: "destructive",
      });
    }
  };

  // Filter and sort uploads
  const filteredUploads = uploads
    .filter(upload => {
      // Search filter
      if (searchQuery && !upload.file_name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      // Type filter
      if (filterType !== 'all') {
        if (filterType === 'image' && !upload.mime_type.startsWith('image/')) {
          return false;
        }
        if (filterType === 'document' && upload.mime_type.startsWith('image/')) {
          return false;
        }
      }
      
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.file_name.localeCompare(b.file_name);
        case 'size':
          return b.file_size - a.file_size;
        case 'date':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

  if (!userId) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center text-muted-foreground">
          <File className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Sign in to view your upload history</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Storage Summary */}
      <div className="bg-muted/50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <Label className="text-lg font-medium">Storage Usage</Label>
          <Badge variant="secondary">
            {uploads.length} file{uploads.length !== 1 ? 's' : ''}
          </Badge>
        </div>
        <div className="text-sm text-muted-foreground">
          Total storage used: <span className="font-medium">{formatFileSize(totalStorage)}</span>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={sortBy} onValueChange={(value: 'date' | 'name' | 'size') => setSortBy(value)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Date
              </div>
            </SelectItem>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="size">Size</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={(value: 'all' | 'image' | 'document') => setFilterType(value)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="image">Images</SelectItem>
            <SelectItem value="document">Documents</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk Actions */}
      {filteredUploads.length > 0 && (
        <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={selectedUploads.size === filteredUploads.length}
              onCheckedChange={handleSelectAll}
            />
            <Label className="text-sm">
              {selectedUploads.size > 0 
                ? `${selectedUploads.size} of ${filteredUploads.length} selected`
                : `Select all ${filteredUploads.length} files`
              }
            </Label>
          </div>
          {selectedUploads.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteSelected}
              disabled={isDeleting}
              className="gap-2"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Delete Selected
                </>
              )}
            </Button>
          )}
        </div>
      )}

      {/* File List */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading upload history...</span>
            </div>
          </div>
        ) : filteredUploads.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center text-muted-foreground">
              <File className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No uploads found</p>
              {searchQuery || filterType !== 'all' ? (
                <p className="text-sm mt-1">Try adjusting your search or filters</p>
              ) : (
                <p className="text-sm mt-1">Upload files to see them here</p>
              )}
            </div>
          </div>
        ) : (
          filteredUploads.map((upload) => {
            const FileIcon = getFileIcon(upload.mime_type);
            return (
              <div
                key={upload.id}
                className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <Checkbox
                  checked={selectedUploads.has(upload.id)}
                  onCheckedChange={(checked) => handleSelectUpload(upload.id, checked as boolean)}
                />
                
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <FileIcon className="h-8 w-8 text-muted-foreground flex-shrink-0" />
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{upload.file_name}</p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{formatFileSize(upload.file_size)}</span>
                      <span>{formatDistanceToNow(new Date(upload.created_at))}</span>
                      <Badge variant="outline" className="text-xs">
                        {upload.file_type}
                      </Badge>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-1 flex-shrink-0">
                  {upload.mime_type.startsWith('image/') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePreviewFile(upload)}
                      className="h-8 w-8 p-0"
                      title="Preview"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownloadFile(upload)}
                    className="h-8 w-8 p-0"
                    title="Download"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      setSelectedUploads(new Set([upload.id]));
                      await handleDeleteSelected();
                    }}
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}