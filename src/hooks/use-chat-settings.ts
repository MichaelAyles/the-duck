"use client";

import { useState, useEffect, useCallback } from 'react';
import { ChatSettings } from '@/components/chat/chat-interface';
import { useModels } from '@/hooks/use-models';
import { useToast } from '@/hooks/use-toast';
import { DEFAULT_CHAT_SETTINGS } from '@/lib/config';

interface UseChatSettingsReturn {
  settings: ChatSettings;
  isProcessingStorage: boolean;
  setIsProcessingStorage: React.Dispatch<React.SetStateAction<boolean>>;
  handleSettingsChange: (newSettings: Partial<ChatSettings>) => Promise<void>;
}

export function useChatSettings(): UseChatSettingsReturn {
  const { primaryModel, setPrimary, isStarred } = useModels();
  const { toast } = useToast();
  
  // Initialize settings with user's primary model instead of hardcoded value
  const [settings, setSettings] = useState<ChatSettings>({
    ...DEFAULT_CHAT_SETTINGS,
    model: primaryModel || DEFAULT_CHAT_SETTINGS.model, // Use centralized fallback
  });
  
  const [isProcessingStorage, setIsProcessingStorage] = useState(false);

  // Update model setting when primary model is loaded
  useEffect(() => {
    if (primaryModel && primaryModel !== settings.model) {
      console.log('Updating model setting to primary model:', primaryModel);
      setSettings(prev => ({ ...prev, model: primaryModel }));
    }
  }, [primaryModel, settings.model]);

  const handleSettingsChange = useCallback(async (newSettings: Partial<ChatSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
    
    // If model is being changed, update the primary model if it's a starred model
    if (newSettings.model && newSettings.model !== settings.model) {
      try {
        // Check if the new model is starred, and if so, set it as primary
        if (isStarred?.(newSettings.model)) {
          console.log('Setting new primary model:', newSettings.model);
          await setPrimary?.(newSettings.model);
          
          toast({
            title: "Model Updated",
            description: `Set ${newSettings.model} as your primary model`,
          });
        }
      } catch (error) {
        console.error('Error setting primary model:', error);
        
        toast({
          title: "Error",
          description: "Failed to update primary model settings",
          variant: "destructive",
        });
      }
    }
  }, [settings.model, isStarred, setPrimary, toast]);

  return {
    settings,
    isProcessingStorage,
    setIsProcessingStorage,
    handleSettingsChange,
  };
}