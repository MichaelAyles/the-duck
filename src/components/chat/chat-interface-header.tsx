"use client";

import React from "react";
import { ChatHeader } from "./chat-header";
import { ChatSettings } from "./chat-types";

interface ChatInterfaceHeaderProps {
  settings: ChatSettings;
  onSettingsChange: (settings: Partial<ChatSettings>) => void;
  onEndChat: () => void;
  messageCount: number;
  onToggleMobileSidebar?: () => void;
  userId?: string;
}

export const ChatInterfaceHeader = React.memo(({
  settings,
  onSettingsChange,
  onEndChat,
  messageCount,
  onToggleMobileSidebar,
  userId
}: ChatInterfaceHeaderProps) => {
  return (
    <ChatHeader
      settings={settings}
      onSettingsChange={onSettingsChange}
      onEndChat={onEndChat}
      messageCount={messageCount}
      onToggleMobileSidebar={onToggleMobileSidebar}
      userId={userId}
    />
  );
});

ChatInterfaceHeader.displayName = 'ChatInterfaceHeader';