"use client";

import React from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useChatSession } from "@/hooks/use-chat-session";
import { useMessageHandling } from "@/hooks/use-message-handling";
import { useChatSettings } from "@/hooks/use-chat-settings";
import { useChatLifecycle } from "@/hooks/use-chat-lifecycle";
import { Message } from "@/types/chat";
import { ChatInterfaceHeader } from "./chat-interface-header";
import { ChatInterfaceInput } from "./chat-interface-input";
import { ChatInterfaceBody } from "./chat-interface-body";
import { ChatInterfaceFull } from "./chat-interface-full";

interface ChatInterfaceProps {
  sessionId?: string | null;
  initialMessages?: Message[];
  isLoading?: boolean;
  onSessionUpdate?: (sessionId: string, newMessages: Message[]) => void;
  renderHeaderOnly?: boolean;
  renderBodyOnly?: boolean;
  renderInputOnly?: boolean;
  onToggleMobileSidebar?: () => void;
}

export const ChatInterface = React.memo(({ 
  sessionId: initialSessionId, 
  initialMessages,
  isLoading: _isPageLoading,
  onSessionUpdate,
  renderHeaderOnly = false,
  renderBodyOnly = false,
  renderInputOnly = false,
  onToggleMobileSidebar
}: ChatInterfaceProps = {}) => {
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
    lockSession,
    unlockSession,
  });

  // Render only header
  if (renderHeaderOnly) {
    return (
      <ChatInterfaceHeader
        settings={settings}
        onSettingsChange={handleSettingsChange}
        onEndChat={handleEndChat}
        messageCount={messages.length - 1}
        onToggleMobileSidebar={onToggleMobileSidebar}
        userId={user?.id}
      />
    );
  }

  // Render only input section
  if (renderInputOnly) {
    return (
      <ChatInterfaceInput
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
        settings={settings}
        isProcessingStorage={isProcessingStorage}
        sessionId={sessionId || undefined}
        userId={user?.id}
      />
    );
  }

  // Render only body (messages only, no input)
  if (renderBodyOnly) {
    return (
      <ChatInterfaceBody
        messages={messages}
        isLoading={isLoading}
        settings={settings}
        sessionId={sessionId || undefined}
        userId={user?.id}
      />
    );
  }

  // Default full render (for non-authenticated users)
  return (
    <ChatInterfaceFull
      messages={messages}
      isLoading={isLoading}
      settings={settings}
      isProcessingStorage={isProcessingStorage}
      onSettingsChange={handleSettingsChange}
      onEndChat={handleEndChat}
      onSendMessage={handleSendMessage}
      onToggleMobileSidebar={onToggleMobileSidebar}
      sessionId={sessionId || undefined}
      userId={user?.id}
    />
  );
});

ChatInterface.displayName = 'ChatInterface';