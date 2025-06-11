"use client";

import React from "react";
import { ChatHeader } from "./chat-header";
import { ChatMessages } from "./chat-messages";
import { ChatInput } from "./chat-input";
import { StorageIndicator } from "./storage-indicator";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/auth-provider";
import { useChatSession } from "@/hooks/use-chat-session";
import { useMessageHandling } from "@/hooks/use-message-handling";
import { useChatSettings } from "@/hooks/use-chat-settings";
import { useChatLifecycle } from "@/hooks/use-chat-lifecycle";

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  metadata?: {
    model?: string;
    tokens?: number;
    processingTime?: number;
  };
}

export interface ChatSettings {
  model: string;
  tone: string;
  storageEnabled: boolean;
}

interface ChatInterfaceProps {
  sessionId?: string | null;
  initialMessages?: Message[];
  isLoading?: boolean;
  onSessionUpdate?: (sessionId: string, newMessages: Message[]) => void;
}

export const ChatInterface = React.memo(({ 
  sessionId: initialSessionId, 
  initialMessages,
  isLoading: _isPageLoading,
  onSessionUpdate 
}: ChatInterfaceProps = {}) => {
  const { user } = useAuth();
  
  // Acknowledge unused parameter
  void _isPageLoading;

  // Use custom hooks for different aspects of chat functionality
  const { sessionId, messages, setMessages, chatServiceRef, createNewSession } = useChatSession({
    initialSessionId,
    initialMessages,
    userId: user?.id,
    onSessionUpdate,
  });

  const { settings, isProcessingStorage, setIsProcessingStorage, handleSettingsChange } = useChatSettings();

  const { handleEndChat } = useChatLifecycle({
    messages,
    setMessages,
    settings,
    chatServiceRef,
    userId: user?.id,
    createNewSession,
    setIsProcessingStorage,
    onSessionUpdate,
  });

  const { isLoading, handleSendMessage } = useMessageHandling({
    sessionId,
    messages,
    setMessages,
    settings,
    chatServiceRef,
    userId: user?.id,
    onSessionUpdate,
  });

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <ChatHeader
        settings={settings}
        onSettingsChange={handleSettingsChange}
        onEndChat={handleEndChat}
        messageCount={messages.length - 1} // Exclude welcome message
      />
      
      <div
        className={cn(
          "flex-1 transition-all duration-300 relative",
          settings.storageEnabled
            ? "bg-transparent"
            : "bg-muted/20"
        )}
      >
        {/* Decorative duck waves pattern */}
        <div className="absolute inset-0 opacity-5 pointer-events-none">
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-primary/20 to-transparent"></div>
          <div className="absolute bottom-8 left-0 right-0 h-2 bg-primary/10 rounded-full"></div>
          <div className="absolute bottom-16 left-8 right-8 h-1 bg-primary/15 rounded-full"></div>
        </div>
        
        <ChatMessages
          messages={messages}
          isLoading={isLoading}
        />
      </div>
      
      <ChatInput
        onSendMessage={handleSendMessage}
        disabled={isLoading}
        storageEnabled={settings.storageEnabled}
      />
      
      <StorageIndicator
        isVisible={isProcessingStorage}
        message="🦆 Processing chat summary and storing preferences..."
      />
    </div>
  );
});

ChatInterface.displayName = 'ChatInterface';