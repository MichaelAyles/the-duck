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
  const { activeModel, setActive, isStarred } = useModels();
  const { toast } = useToast();
  
  // Initialize settings with user's active model instead of hardcoded value
  const [settings, setSettings] = useState<ChatSettings>({
    ...DEFAULT_CHAT_SETTINGS,
    model: activeModel || DEFAULT_CHAT_SETTINGS.model, // Use centralized fallback
  });
  
  const [isProcessingStorage, setIsProcessingStorage] = useState(false);

  // Update model setting when active model is loaded
  useEffect(() => {
    if (activeModel && activeModel !== settings.model) {
      console.log('Updating model setting to active model:', activeModel);
      setSettings(prev => ({ ...prev, model: activeModel }));
    }
  }, [activeModel, settings.model]);

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