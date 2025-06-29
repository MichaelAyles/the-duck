"use client";

import { useState, useCallback, useEffect } from 'react';
import { ChatSettings } from '@/components/chat/chat-types';
import { useStarredModels } from '@/hooks/use-starred-models';
import { useToast } from '@/hooks/use-toast';
import { DEFAULT_CHAT_SETTINGS } from '@/lib/config';
import { preferencesCache } from '@/lib/local-preferences-cache';
import { logger } from '@/lib/logger';

interface UseChatSettingsReturn {
  settings: ChatSettings;
  isProcessingStorage: boolean;
  setIsProcessingStorage: React.Dispatch<React.SetStateAction<boolean>>;
  handleSettingsChange: (newSettings: Partial<ChatSettings>) => Promise<void>;
}

export function useChatSettings(): UseChatSettingsReturn {
  const { activeModel, setActive, isStarred } = useStarredModels();
  const { toast } = useToast();
  
  // Initialize settings with cached preferences or defaults
  const [settings, setSettings] = useState<ChatSettings>(() => {
    const cached = preferencesCache.get()
    if (cached) {
      return {
        model: cached.defaultModel,
        tone: cached.tone,
        memoryEnabled: cached.memoryEnabled,
        memorySummaryCount: cached.memorySummaryCount,
        storageEnabled: cached.storageEnabled,
      }
    }
    return {
      ...DEFAULT_CHAT_SETTINGS,
      model: activeModel || DEFAULT_CHAT_SETTINGS.model,
    }
  });
  
  const [isProcessingStorage, setIsProcessingStorage] = useState(false);

  // Sync with cached preferences when they change
  useEffect(() => {
    const cached = preferencesCache.get()
    if (cached) {
      setSettings(prev => ({
        ...prev,
        model: cached.defaultModel,
        tone: cached.tone,
        memoryEnabled: cached.memoryEnabled,
        memorySummaryCount: cached.memorySummaryCount,
        storageEnabled: cached.storageEnabled,
      }))
    }
  }, [activeModel]) // Re-sync when active model changes

  const handleSettingsChange = useCallback(async (newSettings: Partial<ChatSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
    
    // Update cache immediately for instant UI updates (only update fields that exist in ChatSettings)
    const cacheUpdate: Record<string, unknown> = {}
    if (newSettings.model) cacheUpdate.defaultModel = newSettings.model
    if (newSettings.tone) cacheUpdate.tone = newSettings.tone
    if (newSettings.memoryEnabled !== undefined) cacheUpdate.memoryEnabled = newSettings.memoryEnabled
    if (newSettings.memorySummaryCount !== undefined) cacheUpdate.memorySummaryCount = newSettings.memorySummaryCount
    if (newSettings.storageEnabled !== undefined) cacheUpdate.storageEnabled = newSettings.storageEnabled
    
    if (Object.keys(cacheUpdate).length > 0) {
      preferencesCache.update(cacheUpdate)
    }
    
    // If model is being changed, update the active model if it's a starred model
    if (newSettings.model && newSettings.model !== settings.model) {
      try {
        // Check if the new model is starred, and if so, set it as active
        if (isStarred?.(newSettings.model)) {
          logger.dev.log('Setting new active model:', newSettings.model);
          await setActive?.(newSettings.model);
          
          toast({
            title: "Model Updated",
            description: `Set ${newSettings.model} as your active model`,
          });
        }
      } catch (error) {
        logger.error('Error setting active model:', error);
        
        toast({
          title: "Error",
          description: "Failed to update active model settings",
          variant: "destructive",
        });
      }
    }
  }, [settings.model, isStarred, setActive, toast]);

  return {
    settings,
    isProcessingStorage,
    setIsProcessingStorage,
    handleSettingsChange,
  };
}