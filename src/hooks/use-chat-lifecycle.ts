"use client";

import { useCallback, useEffect } from 'react';
import { ChatService } from '@/lib/chat-service';
import { Message } from '@/types/chat';
import { ChatSettings } from '@/components/chat/chat-interface';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';

interface UseChatLifecycleProps {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  settings: ChatSettings;
  chatServiceRef: React.MutableRefObject<ChatService | null>;
  userId?: string;
  createNewSession: (title?: string) => Promise<string>;
  setIsProcessingStorage: React.Dispatch<React.SetStateAction<boolean>>;
  onSessionUpdate?: (sessionId: string, newMessages: Message[]) => void;
}

interface UseChatLifecycleReturn {
  handleEndChat: () => Promise<void>;
  setupInactivityHandler: () => void;
}

export function useChatLifecycle({
  messages,
  setMessages,
  settings,
  chatServiceRef,
  userId,
  createNewSession,
  setIsProcessingStorage,
  onSessionUpdate,
}: UseChatLifecycleProps): UseChatLifecycleReturn {
  const { toast } = useToast();

  // Define handleEndChat function
  const handleEndChat = useCallback(async () => {
    if (messages.length <= 1) return; // Don't end if only welcome message

    setIsProcessingStorage(true);
    
    try {
      // Get current session title before ending to preserve it
      const currentTitle = await chatServiceRef.current?.getCurrentSessionTitle();
      
      if (settings.storageEnabled && userId) {
        // Summarize chat and store preferences
        await chatServiceRef.current?.summarizeChat(messages);
        
        toast({
          title: "Chat Saved",
          description: `"${currentTitle || 'Your conversation'}" has been summarized and saved`,
        });
      }
      
      // Reset chat and create new session with preserved or default title
      setMessages([]);
      const newSessionId = await createNewSession(currentTitle || undefined);
      
      // Notify parent about session change
      if (onSessionUpdate) {
        onSessionUpdate(newSessionId, []);
      }
      
    } catch (error) {
      logger.error("Error ending chat:", error);
      
      toast({
        title: "Error",
        description: "Failed to save chat. Your conversation may not be stored.",
        variant: "destructive",
      });
    } finally {
      setIsProcessingStorage(false);
    }
  }, [
    messages,
    settings.storageEnabled,
    userId,
    chatServiceRef,
    setMessages,
    createNewSession,
    onSessionUpdate,
    setIsProcessingStorage,
    toast,
  ]);

  // Setup inactivity handler
  const setupInactivityHandler = useCallback(() => {
    chatServiceRef.current?.setupInactivityHandler(async () => {
      if (messages.length > 1) { // Don't end if only welcome message
        await handleEndChat();
      }
    });
  }, [chatServiceRef, messages.length, handleEndChat]);

  // Setup inactivity handler when component mounts and when messages change
  useEffect(() => {
    const chatService = chatServiceRef.current;
    setupInactivityHandler();
    
    // Cleanup function to prevent memory leaks
    return () => {
      // Use the captured value from effect scope
      chatService?.clearInactivityTimer();
    };
  }, [setupInactivityHandler, chatServiceRef]);

  return {
    handleEndChat,
    setupInactivityHandler,
  };
}