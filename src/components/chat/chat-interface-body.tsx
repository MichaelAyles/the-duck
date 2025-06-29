"use client";

import React from "react";
import { ChatMessages } from "./chat-messages";
import { ErrorBoundary } from "@/components/error-boundary";
import { cn } from "@/lib/utils";
import { Message } from "@/types/chat";
import { ChatSettings } from "./chat-types";

interface ChatInterfaceBodyProps {
  messages: Message[];
  isLoading: boolean;
  settings: ChatSettings;
  sessionId?: string;
  userId?: string;
}

export const ChatInterfaceBody = React.memo(({
  messages,
  isLoading,
  settings,
  sessionId,
  userId
}: ChatInterfaceBodyProps) => {
  return (
    <ErrorBoundary>
      <div className="flex flex-col h-full bg-gradient-to-br from-background via-background to-primary/5 min-h-0">
        <ErrorBoundary>
          <div
            className={cn(
              "flex-1 transition-all duration-300 relative min-h-0 flex flex-col",
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
      </div>
    </ErrorBoundary>
  );
});

ChatInterfaceBody.displayName = 'ChatInterfaceBody';