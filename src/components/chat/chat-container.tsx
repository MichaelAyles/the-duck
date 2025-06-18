"use client";

import React, { useState, useEffect } from "react";
import { ChatHeader } from "./chat-header";
import { ChatMessages } from "./chat-messages";
import { ChatInput } from "./chat-input";
import { StorageIndicator } from "./storage-indicator";
import { ErrorBoundary } from "@/components/error-boundary";
import { BillingNotice, CreditWarning } from "@/components/billing-notice";
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
  const [showBillingNotice, setShowBillingNotice] = useState(true);
  const [credits, setCredits] = useState<{ remainingCredits: number; totalCredits: number } | null>(null);
  
  // Acknowledge unused parameter
  void _isPageLoading;

  // Fetch credit information when user is available
  useEffect(() => {
    if (user) {
      const fetchCredits = async () => {
        try {
          const response = await fetch('/api/credits');
          if (response.ok) {
            const data = await response.json();
            if (data.credits) {
              setCredits({
                remainingCredits: data.credits.total_credits - data.credits.used_credits,
                totalCredits: data.credits.total_credits
              });
            }
          }
        } catch (error) {
          console.error('Failed to fetch credits:', error);
        }
      };

      fetchCredits();
    }
  }, [user]);

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
          />
        </div>

        {/* Billing Notice & Credit Warning */}
        {user && (
          <div className="flex-none px-4 space-y-2">
            {showBillingNotice && (
              <BillingNotice 
                variant="info"
                onDismiss={() => setShowBillingNotice(false)}
                className="text-xs"
              />
            )}
            {credits && credits.remainingCredits < credits.totalCredits * 0.5 && (
              <CreditWarning 
                remainingCredits={credits.remainingCredits}
                totalCredits={credits.totalCredits}
                className="text-xs"
              />
            )}
          </div>
        )}

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