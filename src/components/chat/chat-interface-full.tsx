"use client";

import React from "react";
import { ChatHeader } from "./chat-header";
import { ChatMessages } from "./chat-messages";
import { ChatInput } from "./chat-input";
import { StorageIndicator } from "./storage-indicator";
import { ErrorBoundary } from "@/components/error-boundary";
import { cn } from "@/lib/utils";
import { Message } from "@/types/chat";
import { ChatSettings } from "./chat-types";

interface ChatInterfaceFullProps {
  messages: Message[];
  isLoading: boolean;
  settings: ChatSettings;
  isProcessingStorage: boolean;
  onSettingsChange: (settings: Partial<ChatSettings>) => void;
  onEndChat: () => void;
  onSendMessage: (message: string) => void;
  onToggleMobileSidebar?: () => void;
  sessionId?: string;
  userId?: string;
}

export const ChatInterfaceFull = React.memo(({
  messages,
  isLoading,
  settings,
  isProcessingStorage,
  onSettingsChange,
  onEndChat,
  onSendMessage,
  onToggleMobileSidebar,
  sessionId,
  userId
}: ChatInterfaceFullProps) => {
  return (
    <ErrorBoundary>
      <div className="flex flex-col h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <ChatHeader
          settings={settings}
          onSettingsChange={onSettingsChange}
          onEndChat={onEndChat}
          messageCount={messages.length - 1}
          onToggleMobileSidebar={onToggleMobileSidebar}
          userId={userId}
        />
        
        <ErrorBoundary>
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
              userId={userId}
              sessionId={sessionId}
            />
          </div>
        </ErrorBoundary>
        
        <ErrorBoundary>
          <ChatInput
            onSendMessage={onSendMessage}
            disabled={isLoading}
            storageEnabled={settings.storageEnabled}
            sessionId={sessionId}
            userId={userId}
          />
        </ErrorBoundary>
        
        <StorageIndicator
          isVisible={isProcessingStorage}
          message="Processing chat summary and storing preferences..."
        />
      </div>
    </ErrorBoundary>
  );
});

ChatInterfaceFull.displayName = 'ChatInterfaceFull';