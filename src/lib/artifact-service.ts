import { 
  Artifact, 
  ParsedArtifact, 
  ArtifactSaveResult,
  ArtifactType 
} from '@/types/artifact';
import { FileUpload } from '@/types/file-upload';
import { ArtifactParser } from './artifact-parser';
import { logger } from './logger';

export class ArtifactService {
  // Temporary in-memory storage for artifacts during development
  private static tempArtifactStorage = new Map<string, {
    id: string;
    content: string;
    metadata: {
      fileName: string;
      mimeType: string;
      userId: string;
      sessionId?: string;
      messageId?: string;
      title: string;
      description?: string;
      type: ArtifactType;
    };
  }>();
  /**
   * Save a parsed artifact to storage using the existing file upload system
   */
  static async saveArtifact(
    artifact: ParsedArtifact,
    userId: string,
    sessionId?: string,
    messageId?: string
  ): Promise<ArtifactSaveResult> {
    try {
      // Validate artifact
      const validation = ArtifactParser.validateArtifact(artifact);
      if (!validation.valid) {
        return {
          success: false,
          error: `Artifact validation failed: ${validation.errors.join(', ')}`,
        };
      }

      // Generate file name and MIME type
      const fileName = ArtifactParser.generateFileName(artifact);
      const mimeType = ArtifactParser.getMimeType(artifact.type);

      // For demo purposes, create a temporary in-memory artifact
      // This bypasses the file upload system for now
      const artifactId = crypto.randomUUID();
      
      // Store in a temporary cache (in production, this would be proper storage)
      this.tempArtifactStorage.set(artifactId, {
        id: artifactId,
        content: artifact.content,
        metadata: {
          fileName,
          mimeType,
          userId,
          sessionId,
          messageId,
          title: artifact.title,
          description: artifact.description,
          type: artifact.type
        }
      });

      logger.dev.log(`Artifact saved: ${fileName} (${artifactId})`);

      return {
        success: true,
        artifactId: artifactId,
        fileId: artifactId,
        url: undefined,
      };
    } catch (error) {
      logger.error('Failed to save artifact:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Load an artifact from storage by file ID
   */
  static async loadArtifact(artifactId: string): Promise<Artifact | null> {
    try {
      // Check temporary storage first
      const tempArtifact = this.tempArtifactStorage.get(artifactId);
      if (tempArtifact) {
        const artifact: Artifact = {
          id: tempArtifact.id,
          type: tempArtifact.metadata.type,
          title: tempArtifact.metadata.title,
          description: tempArtifact.metadata.description,
          content: tempArtifact.content,
          fileId: tempArtifact.id,
          messageId: tempArtifact.metadata.messageId,
          sessionId: tempArtifact.metadata.sessionId,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        return artifact;
      }

      // Fallback to old storage method (if needed in the future)
      logger.dev.log(`Artifact ${artifactId} not found in temporary storage`);
      return null;
    } catch (error) {
      logger.error('Failed to load artifact:', error);
      return null;
    }
  }

  /**
   * Get all artifacts for a session
   */
  static async getSessionArtifacts(sessionId: string): Promise<Artifact[]> {
    try {
      const response = await fetch(`/api/files?session_id=${sessionId}&artifact_only=true`);
      if (!response.ok) {
        throw new Error('Failed to fetch session artifacts');
      }

      const files: FileUpload[] = await response.json();
      
      // Filter for artifact files and convert to Artifact objects
      const artifactFiles = files.filter(file => 
        file.mime_type.startsWith('text/x-') || 
        file.mime_type === 'text/javascript' ||
        file.mime_type === 'text/html' ||
        file.mime_type === 'text/css'
      );

      const artifacts: Artifact[] = [];
      
      for (const file of artifactFiles) {
        const artifact = await this.loadArtifact(file.id);
        if (artifact) {
          artifacts.push(artifact);
        }
      }

      return artifacts;
    } catch (error) {
      logger.error('Failed to get session artifacts:', error);
      return [];
    }
  }

  /**
   * Update an existing artifact
   */
  static async updateArtifact(
    artifactId: string,
    newContent: string,
    userId: string
  ): Promise<ArtifactSaveResult> {
    try {
      // Load existing artifact to get metadata
      const existingArtifact = await this.loadArtifact(artifactId);
      if (!existingArtifact) {
        return {
          success: false,
          error: 'Artifact not found',
        };
      }

      // Create updated parsed artifact
      const updatedArtifact: ParsedArtifact = {
        type: existingArtifact.type,
        title: existingArtifact.title,
        description: existingArtifact.description,
        content: newContent,
        metadata: existingArtifact.metadata,
      };

      // Save as new version (for now, we'll create a new file)
      // TODO: Implement proper versioning system
      const saveResult = await this.saveArtifact(
        updatedArtifact,
        userId,
        existingArtifact.sessionId,
        existingArtifact.messageId
      );

      return saveResult;
    } catch (error) {
      logger.error('Failed to update artifact:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Delete an artifact
   */
  static async deleteArtifact(artifactId: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/files/${artifactId}`, {
        method: 'DELETE',
      });

      return response.ok;
    } catch (error) {
      logger.error('Failed to delete artifact:', error);
      return false;
    }
  }

  // Helper methods

  private static generateStoragePath(userId: string, fileName: string): string {
    const timestamp = Date.now();
    return `${userId}/artifacts/${timestamp}-${fileName}`;
  }

  private static getFileTypeFromMime(mimeType: string): string {
    const mimeToType: Record<string, string> = {
      'text/x-react-component': 'jsx',
      'text/x-duckpond-artifact': 'artifact',
      'text/html': 'html',
      'text/javascript': 'js',
      'text/css': 'css',
      'application/json': 'json',
    };

    return mimeToType[mimeType] || 'artifact';
  }

  private static getArtifactTypeFromMime(mimeType: string): ArtifactType {
    const mimeToArtifactType: Record<string, ArtifactType> = {
      'text/x-react-component': 'react-component',
      'text/html': 'html',
      'text/javascript': 'javascript',
      'text/css': 'css',
      'application/json': 'json',
    };

    return mimeToArtifactType[mimeType] || 'react-component';
  }

  private static extractTitleFromFileName(fileName: string): string {
    // Remove timestamp and extension from generated file names
    const withoutExt = fileName.replace(/\.[^.]+$/, '');
    const withoutTimestamp = withoutExt.replace(/-\d+$/, '');
    
    // Convert dashes to spaces and capitalize
    return withoutTimestamp
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private static async uploadToStorage(): Promise<{ success: boolean; error?: string }> {
    try {
      // This would typically use the Supabase client directly
      // For now, we'll simulate the upload
      // TODO: Implement direct Supabase storage upload
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Storage upload failed' 
      };
    }
  }

  private static async getSignedUrl(storagePath: string): Promise<string | null> {
    try {
      // This would get a signed URL from Supabase storage
      // For now, we'll return a placeholder
      // TODO: Implement Supabase signed URL generation
      return `/api/files/storage/${encodeURIComponent(storagePath)}`;
    } catch (error) {
      logger.error('Failed to get signed URL:', error);
      return null;
    }
  }
}