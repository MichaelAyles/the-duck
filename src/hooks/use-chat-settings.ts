"use client";

import { useState, useCallback } from 'react';
import { ChatSettings } from '@/components/chat/chat-interface';
import { useStarredModels } from '@/hooks/use-starred-models';
import { useToast } from '@/hooks/use-toast';
import { DEFAULT_CHAT_SETTINGS } from '@/lib/config';

interface UseChatSettingsReturn {
  settings: ChatSettings;
  isProcessingStorage: boolean;
  setIsProcessingStorage: React.Dispatch<React.SetStateAction<boolean>>;
  handleSettingsChange: (newSettings: Partial<ChatSettings>) => Promise<void>;
}

export function useChatSettings(): UseChatSettingsReturn {
  const { activeModel, setActive, isStarred } = useStarredModels();
  const { toast } = useToast();
  
  // Initialize settings with active model (this doesn't trigger API calls)
  const [settings, setSettings] = useState<ChatSettings>({
    ...DEFAULT_CHAT_SETTINGS,
    model: activeModel || DEFAULT_CHAT_SETTINGS.model,
  });
  
  const [isProcessingStorage, setIsProcessingStorage] = useState(false);

  const handleSettingsChange = useCallback(async (newSettings: Partial<ChatSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
    
    // If model is being changed, update the active model if it's a starred model
    if (newSettings.model && newSettings.model !== settings.model) {
      try {
        // Check if the new model is starred, and if so, set it as active
        if (isStarred?.(newSettings.model)) {
          console.log('Setting new active model:', newSettings.model);
          await setActive?.(newSettings.model);
          
          toast({
            title: "Model Updated",
            description: `Set ${newSettings.model} as your active model`,
          });
        }
      } catch (error) {
        console.error('Error setting active model:', error);
        
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