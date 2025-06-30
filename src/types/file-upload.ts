export interface FileUpload {
  id: string;
  user_id: string;
  session_id?: string;
  message_id?: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  mime_type: string;
  created_at: string;
  deleted_at?: string;
}

export interface FileUploadRequest {
  file: File;
  sessionId?: string;
  messageId?: string;
}

export interface FileUploadResponse {
  success: boolean;
  fileUpload?: FileUpload;
  url?: string;
  error?: string;
}

export interface FileUploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export const ALLOWED_FILE_TYPES = {
  // Images
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'image/svg+xml': ['.svg'],
  // Documents
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-powerpoint': ['.ppt'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  // Text
  'text/plain': ['.txt'],
  'text/csv': ['.csv'],
  'text/markdown': ['.md'],
  // Code
  'text/javascript': ['.js'],
  'application/json': ['.json'],
  'text/html': ['.html'],
  'text/css': ['.css'],
  'text/typescript': ['.ts', '.tsx'],
  // DuckPond Artifacts
  'text/x-react-component': ['.jsx', '.tsx'],
  'text/x-duckpond-artifact': ['.artifact'],
  // Archives
  'application/zip': ['.zip'],
  'application/x-tar': ['.tar'],
  'application/x-gzip': ['.gz'],
};

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function isAllowedFileType(mimeType: string): boolean {
  return mimeType in ALLOWED_FILE_TYPES;
}

export function getFileExtensions(): string[] {
  return Object.values(ALLOWED_FILE_TYPES).flat();
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}