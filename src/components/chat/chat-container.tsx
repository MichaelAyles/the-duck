"use client";

import React from "react";
import { ChatHeader } from "./chat-header";
import { ChatMessages } from "./chat-messages";
import { ChatInput } from "./chat-input";
import { StorageIndicator } from "./storage-indicator";
import { ErrorBoundary } from "@/components/error-boundary";
import { useAuth } from "@/components/auth/auth-provider";
import { useChatSession } from "@/hooks/use-chat-session";
import { useMessageHandling } from "@/hooks/use-message-handling";
import { useChatSettings } from "@/hooks/use-chat-settings";
import { useChatLifecycle } from "@/hooks/use-chat-lifecycle";
import { Message } from "@/types/chat";

interface ChatContainerProps {
  sessionId?: string | null;
  initialMessages?: Message[];
  isLoading?: boolean;
  onSessionUpdate?: (sessionId: string, newMessages: Message[]) => void;
  onToggleMobileSidebar?: () => void;
  onTitleGenerated?: (sessionId: string, title: string) => void;
}

export const ChatContainer = React.memo(({ 
  sessionId: initialSessionId, 
  initialMessages,
  isLoading: _isPageLoading,
  onSessionUpdate,
  onToggleMobileSidebar,
  onTitleGenerated
}: ChatContainerProps = {}) => {
  const { user } = useAuth();
  
  // Acknowledge unused parameter
  void _isPageLoading;


  // Use custom hooks for different aspects of chat functionality
  const { sessionId, messages, setMessages, chatServiceRef, createNewSession, lockSession, unlockSession } = useChatSession({
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
    onTitleGenerated,
    lockSession,
    unlockSession,
  });

  return (
    <ErrorBoundary>
      <div className="flex flex-col h-full bg-background overflow-hidden">
        {/* Header */}
        <div className="flex-none">
          <ChatHeader
            settings={settings}
            onSettingsChange={handleSettingsChange}
            onEndChat={handleEndChat}
            messageCount={messages.length - 1}
            onToggleMobileSidebar={onToggleMobileSidebar}
            userId={user?.id}
          />
        </div>


        {/* Messages - Allow scrolling */}
        <div className="flex-1 min-h-0">
          <ChatMessages messages={messages} isLoading={isLoading} />
        </div>

        {/* Input */}
        <div className="flex-none">
          <ChatInput
            onSendMessage={handleSendMessage}
            disabled={isLoading}
            storageEnabled={settings.storageEnabled}
            sessionId={sessionId || undefined}
            userId={user?.id}
          />
          {isProcessingStorage && (
            <StorageIndicator
              isVisible={isProcessingStorage}
              message={settings.storageEnabled ? "Saving chat..." : "Processing..."}
            />
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
});

ChatContainer.displayName = "ChatContainer";