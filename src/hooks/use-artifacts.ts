"use client";

import { useState, useCallback, useEffect } from 'react';
import { Message } from '@/types/chat';
import { Artifact, ArtifactDetectionResult } from '@/types/artifact';
import { ArtifactParser } from '@/lib/artifact-parser';
import { ArtifactService } from '@/lib/artifact-service';
import { logger } from '@/lib/logger';

interface UseArtifactsProps {
  userId?: string;
  sessionId?: string;
}

interface UseArtifactsReturn {
  processMessageForArtifacts: (message: Message) => Promise<Message>;
  getArtifactsFromMessage: (message: Message) => NonNullable<Message['artifacts']>;
  loadArtifact: (artifactId: string) => Promise<Artifact | null>;
  saveArtifact: (content: string, messageId: string) => Promise<boolean>;
  isProcessing: boolean;
  error: string | null;
}

export function useArtifacts({ userId, sessionId }: UseArtifactsProps): UseArtifactsReturn {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [artifactCache, setArtifactCache] = useState<Map<string, Artifact>>(new Map());

  const processMessageForArtifacts = useCallback(async (message: Message): Promise<Message> => {
    if (message.role !== 'assistant' || !userId) {
      return message;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Parse content for artifacts
      const detection: ArtifactDetectionResult = ArtifactParser.parseContent(message.content);
      
      logger.dev.log(`Artifact detection result for message ${message.id}:`, {
        hasArtifacts: detection.hasArtifacts,
        artifactCount: detection.artifacts.length,
        artifacts: detection.artifacts.map(a => ({ type: a.type, title: a.title }))
      });
      
      if (!detection.hasArtifacts) {
        return message;
      }

      // Save each artifact to storage
      const savedArtifacts: Message['artifacts'] = [];
      
      for (const parsedArtifact of detection.artifacts) {
        const saveResult = await ArtifactService.saveArtifact(
          parsedArtifact,
          userId,
          sessionId,
          message.id
        );

        if (saveResult.success && saveResult.artifactId) {
          savedArtifacts.push({
            id: saveResult.artifactId,
            type: parsedArtifact.type as NonNullable<Message['artifacts']>[0]['type'],
            title: parsedArtifact.title,
            description: parsedArtifact.description,
            fileId: saveResult.fileId,
          });

          // Cache the full artifact for immediate use
          const fullArtifact: Artifact = {
            id: saveResult.artifactId,
            type: parsedArtifact.type,
            title: parsedArtifact.title,
            description: parsedArtifact.description,
            content: parsedArtifact.content,
            fileId: saveResult.fileId,
            messageId: message.id,
            sessionId,
            version: 1,
            metadata: parsedArtifact.metadata,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          setArtifactCache(prev => new Map(prev.set(saveResult.artifactId!, fullArtifact)));
          
          logger.dev.log(`Artifact saved: ${parsedArtifact.title} (${saveResult.artifactId})`);
        } else {
          logger.error(`Failed to save artifact: ${parsedArtifact.title}`, saveResult.error);
        }
      }

      // Return message with cleaned content and artifact references
      return {
        ...message,
        content: detection.cleanedContent,
        artifacts: savedArtifacts.length > 0 ? savedArtifacts : undefined,
      };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process artifacts';
      setError(errorMessage);
      logger.error('Artifact processing error:', err);
      return message;
    } finally {
      setIsProcessing(false);
    }
  }, [userId, sessionId]);

  const getArtifactsFromMessage = useCallback((message: Message): NonNullable<Message['artifacts']> => {
    if (!message.artifacts) return [];

    // Return the artifact references directly - they contain enough info to render the buttons
    // Full artifacts will be loaded on-demand when the user clicks "Run in DuckPond"
    return message.artifacts;
  }, []);

  const loadArtifact = useCallback(async (artifactId: string): Promise<Artifact | null> => {
    // Check cache first
    const cached = artifactCache.get(artifactId);
    if (cached) {
      return cached;
    }

    try {
      const artifact = await ArtifactService.loadArtifact(artifactId);
      
      if (artifact) {
        setArtifactCache(prev => new Map(prev.set(artifactId, artifact)));
      }
      
      return artifact;
    } catch (err) {
      logger.error('Failed to load artifact:', err);
      return null;
    }
  }, [artifactCache]);

  const saveArtifact = useCallback(async (content: string, messageId: string): Promise<boolean> => {
    if (!userId) return false;

    try {
      setIsProcessing(true);
      
      // Parse content to extract artifacts
      const detection = ArtifactParser.parseContent(content);
      
      if (!detection.hasArtifacts) {
        return false;
      }

      // Save first artifact (for now)
      const artifact = detection.artifacts[0];
      const saveResult = await ArtifactService.saveArtifact(
        artifact,
        userId,
        sessionId,
        messageId
      );

      return saveResult.success;
    } catch (err) {
      logger.error('Failed to save artifact:', err);
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [userId, sessionId]);

  // Clear cache when session changes
  useEffect(() => {
    setArtifactCache(new Map());
  }, [sessionId]);

  return {
    processMessageForArtifacts,
    getArtifactsFromMessage,
    loadArtifact,
    saveArtifact,
    isProcessing,
    error,
  };
}