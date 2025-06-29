"use client";

import React from "react";
import { ChatInput } from "./chat-input";
import { StorageIndicator } from "./storage-indicator";
import { ErrorBoundary } from "@/components/error-boundary";
import { ChatSettings } from "./chat-types";

interface ChatInterfaceInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  settings: ChatSettings;
  isProcessingStorage: boolean;
  sessionId?: string;
  userId?: string;
}

export const ChatInterfaceInput = React.memo(({
  onSendMessage,
  isLoading,
  settings,
  isProcessingStorage,
  sessionId,
  userId
}: ChatInterfaceInputProps) => {
  return (
    <ErrorBoundary>
      <div className="flex-none">
        <ChatInput
          onSendMessage={onSendMessage}
          disabled={isLoading}
          storageEnabled={settings.storageEnabled}
          sessionId={sessionId}
          userId={userId}
        />
      </div>
      
      <StorageIndicator
        isVisible={isProcessingStorage}
        message="Processing chat summary and storing preferences..."
      />
    </ErrorBoundary>
  );
});

ChatInterfaceInput.displayName = 'ChatInterfaceInput';