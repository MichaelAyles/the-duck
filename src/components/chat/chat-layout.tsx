"use client";

import React, { useState, useCallback } from "react";
import { Message } from "@/types/chat";
import { ChatInterface } from "./chat-interface";
import { ChatHistorySidebar } from "./chat-history-sidebar";
import { useAuth } from "@/components/auth/auth-provider";
import { useToast } from "@/hooks/use-toast";

export function ChatLayout() {
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleSessionSelect = useCallback(async (sessionId: string) => {
    if (sessionId === currentSessionId) return;

    setIsLoading(true);
    setCurrentSessionId(sessionId);
    setMessages([]); // Clear previous messages

    try {
      const response = await fetch(`/api/load-session?sessionId=${sessionId}`);
      if (!response.ok) {
        throw new Error("Failed to load session");
      }
      const data = await response.json();
      setMessages(data.session?.messages || []);
      toast({
        title: "Chat Loaded",
        description: `Successfully loaded session: ${data.session?.title?.slice(0, 30)}...`,
      });
    } catch (error) {
      console.error("Error loading session:", error);
      toast({
        title: "Error",
        description: "Could not load the selected chat session.",
        variant: "destructive",
      });
      setCurrentSessionId(null); // Reset on error
    } finally {
      setIsLoading(false);
    }
  }, [currentSessionId, toast]);

  const handleNewChat = useCallback(() => {
    setCurrentSessionId(null);
    setMessages([]);
    setRefreshTrigger(prev => prev + 1); // Refresh history to show new chat
  }, []);

  const handleSessionUpdate = useCallback((sessionId: string, newMessages: Message[]) => {
    setCurrentSessionId(sessionId);
    setMessages(newMessages);
    setRefreshTrigger(prev => prev + 1); // Refresh history to update timestamp
  }, []);

  const handleToggleSidebar = useCallback(() => {
    setIsSidebarCollapsed(prev => !prev);
  }, []);

  // If no user, show chat interface without sidebar
  if (!user) {
    return <ChatInterface />;
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header - Fixed at top spanning full width */}
      <div className="flex-none">
        <ChatInterface
          key={currentSessionId || 'new'}
          sessionId={currentSessionId}
          initialMessages={messages}
          isLoading={isLoading}
          onSessionUpdate={handleSessionUpdate}
          renderHeaderOnly={true}
        />
      </div>
      
      {/* Middle Section - Sidebar and Chat Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Fixed width, between header and footer */}
        <div className="flex-none">
          <ChatHistorySidebar
            currentSessionId={currentSessionId || undefined}
            onSessionSelect={handleSessionSelect}
            onNewChat={handleNewChat}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={handleToggleSidebar}
            refreshTrigger={refreshTrigger}
            className="h-full"
          />
        </div>
        
        {/* Chat Messages Area - Scrollable content */}
        <div className="flex-1 flex flex-col min-h-0">
          <ChatInterface
            key={currentSessionId || 'new'}
            sessionId={currentSessionId}
            initialMessages={messages}
            isLoading={isLoading}
            onSessionUpdate={handleSessionUpdate}
            renderBodyOnly={true}
          />
        </div>
      </div>
      
      {/* Footer - Fixed at bottom spanning full width */}
      <div className="flex-none">
        <ChatInterface
          key={currentSessionId || 'new'}
          sessionId={currentSessionId}
          initialMessages={messages}
          isLoading={isLoading}
          onSessionUpdate={handleSessionUpdate}
          renderInputOnly={true}
        />
      </div>
    </div>
  );
} 