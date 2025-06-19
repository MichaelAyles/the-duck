"use client";

import React, { useState, useCallback } from "react";
import { Message } from "@/types/chat";
import { ChatContainer } from "./chat-container";
import { ChatHistorySidebar } from "./chat-history-sidebar";
import { useAuth } from "@/components/auth/auth-provider";
import { useToast } from "@/hooks/use-toast";
import { useArtifactPanel } from "@/contexts/artifact-panel-context";
import { cn } from "@/lib/utils";

export function ChatLayout() {
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { user } = useAuth();
  const { toast } = useToast();
  const { isOpen: isArtifactPanelOpen } = useArtifactPanel();

  const handleSessionSelect = useCallback(async (sessionId: string) => {
    if (sessionId === currentSessionId) return;

    setIsLoading(true);
    setCurrentSessionId(sessionId);
    setMessages([]); // Clear previous messages

    try {
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔄 Loading session: ${sessionId}`);
      }
      const response = await fetch(`/api/load-session?sessionId=${sessionId}`);
      if (!response.ok) {
        throw new Error("Failed to load session");
      }
      const data = await response.json();
      const messages = data.session?.messages || [];
      const title = data.session?.title || 'Untitled Chat';
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`Loaded session ${sessionId}:`, {
          title,
          messageCount: messages.length,
          hasMessages: messages.length > 0
        });
      }
      
      setMessages(messages);
      toast({
        title: "Chat Loaded",
        description: `Successfully loaded session: ${title.slice(0, 30)}...`,
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

  const handleNewChat = useCallback(async () => {
    try {
      // Create and persist new session immediately
      const newSessionId = crypto.randomUUID();
      
      // Save empty session to database so it appears in sidebar
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: newSessionId,
          title: 'New Chat',
          messages: [],
          model: 'google/gemini-2.5-flash-preview-05-20', // Default model
        }),
      });
      
      if (response.ok) {
        console.log(`✅ New empty session ${newSessionId} created and saved to database`);
        
        // Update local state
        setCurrentSessionId(newSessionId);
        setMessages([]);
        setRefreshTrigger(prev => prev + 1); // Refresh history to show new chat
      } else {
        console.error('Failed to create new session:', await response.text());
        // Fallback to old behavior
        setCurrentSessionId(null);
        setMessages([]);
        setRefreshTrigger(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error creating new chat session:', error);
      // Fallback to old behavior
      setCurrentSessionId(null);
      setMessages([]);
      setRefreshTrigger(prev => prev + 1);
    }
  }, []);

  const handleSessionUpdate = useCallback((sessionId: string, newMessages: Message[]) => {
    setCurrentSessionId(sessionId);
    setMessages(newMessages);
    setRefreshTrigger(prev => prev + 1); // Refresh history to update timestamp
  }, []);

  const handleTitleGenerated = useCallback((sessionId: string, title: string) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`🏷️ Title generated for session ${sessionId}: ${title}`);
    }
    setRefreshTrigger(prev => prev + 1); // Refresh sidebar to show new title
  }, []);

  const handleToggleSidebar = useCallback(() => {
    setIsSidebarCollapsed(prev => !prev);
  }, []);

  const handleToggleMobileSidebar = useCallback(() => {
    setIsMobileSidebarOpen(prev => !prev);
  }, []);

  const handleMobileSessionSelect = useCallback(async (sessionId: string) => {
    setIsMobileSidebarOpen(false); // Close mobile sidebar after selection
    await handleSessionSelect(sessionId);
  }, [handleSessionSelect]);

  const handleMobileNewChat = useCallback(() => {
    setIsMobileSidebarOpen(false); // Close mobile sidebar after new chat
    handleNewChat();
  }, [handleNewChat]);

  // If no user, show chat interface without sidebar
  if (!user) {
    return <ChatContainer />;
  }

  return (
    <div className="flex h-screen bg-background relative">
      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
          {/* Mobile Sidebar */}
          <div className="fixed inset-y-0 left-0 z-50 w-80 lg:hidden">
            <ChatHistorySidebar
              currentSessionId={currentSessionId || undefined}
              onSessionSelect={handleMobileSessionSelect}
              onNewChat={handleMobileNewChat}
              isCollapsed={false}
              onToggleCollapse={handleToggleMobileSidebar}
              refreshTrigger={refreshTrigger}
              className="h-full"
            />
          </div>
        </>
      )}

      {/* Sidebar - Fixed width, hidden on mobile */}
      <div className="flex-none hidden lg:block">
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
      
      {/* Chat Container - Single instance managing all chat UI */}
      <div className={cn(
        "flex-1 flex flex-col min-h-0 overflow-hidden transition-all duration-300",
        isArtifactPanelOpen && "mr-[40%]" // Make room for artifact panel
      )}>
        <ChatContainer
          sessionId={currentSessionId}
          initialMessages={messages}
          isLoading={isLoading}
          onSessionUpdate={handleSessionUpdate}
          onToggleMobileSidebar={handleToggleMobileSidebar}
          onTitleGenerated={handleTitleGenerated}
        />
      </div>
    </div>
  );
} 