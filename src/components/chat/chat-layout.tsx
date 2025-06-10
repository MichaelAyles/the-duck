"use client";

import React, { useState, useCallback } from "react";
import { ChatInterface } from "./chat-interface";
import { ChatHistorySidebar } from "./chat-history-sidebar";
import { useAuth } from "@/components/auth/auth-provider";

export function ChatLayout() {
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { user } = useAuth();

  const handleSessionSelect = useCallback((sessionId: string) => {
    setCurrentSessionId(sessionId);
    // Trigger a refresh of the chat history to ensure it's up to date
    setRefreshTrigger(prev => prev + 1);
  }, []);

  const handleNewChat = useCallback(() => {
    setCurrentSessionId(null);
  }, []);

  const handleToggleSidebar = useCallback(() => {
    setIsSidebarCollapsed(prev => !prev);
  }, []);

  // If no user, show chat interface without sidebar
  if (!user) {
    return <ChatInterface />;
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <ChatHistorySidebar
        currentSessionId={currentSessionId || undefined}
        onSessionSelect={handleSessionSelect}
        onNewChat={handleNewChat}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
        refreshTrigger={refreshTrigger}
      />
      
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        <ChatInterface
          key={currentSessionId || 'new'} // Force re-render when session changes
          sessionId={currentSessionId}
          onSessionUpdate={handleSessionSelect}
        />
      </div>
    </div>
  );
} 