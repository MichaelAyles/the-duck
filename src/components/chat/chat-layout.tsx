"use client";

import React, { useState, useCallback } from "react";
import { Message } from "@/types/chat";
import { ChatInterface } from "./chat-interface";
import { ChatHistorySidebar } from "./chat-history-sidebar";
import { useAuth } from "@/components/auth/auth-provider";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export function ChatLayout() {
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleSessionSelect = useCallback(async (sessionId: string) => {
    if (sessionId === currentSessionId) return;

    setIsLoading(true);
    setCurrentSessionId(sessionId);
    setMessages([]); // Clear previous messages

    try {
      console.log(`🔄 Loading session: ${sessionId}`);
      const response = await fetch(`/api/load-session?sessionId=${sessionId}`);
      if (!response.ok) {
        throw new Error("Failed to load session");
      }
      const data = await response.json();
      const messages = data.session?.messages || [];
      const title = data.session?.title || 'Untitled Chat';
      
      console.log(`✅ Loaded session ${sessionId}:`, {
        title,
        messageCount: messages.length,
        hasMessages: messages.length > 0
      });
      
      setMessages(messages);
      toast({
        title: "Chat Loaded",
        description: `Successfully loaded session: ${title.slice(0, 30)}...`,
      });
    } catch (error) {
      console.error("❌ Error loading session:", error);
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
    return <ChatInterface />;
  }

  return (
    <div className="flex flex-col h-screen bg-background relative">
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

      {/* Header - Fixed at top spanning full width */}
      <div className="flex-none">
        <ChatInterface
          key={currentSessionId || 'new'}
          sessionId={currentSessionId}
          initialMessages={messages}
          isLoading={isLoading}
          onSessionUpdate={handleSessionUpdate}
          renderHeaderOnly={true}
          onToggleMobileSidebar={handleToggleMobileSidebar}
        />
      </div>
      
      {/* Middle Section - Sidebar and Chat Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Fixed width, between header and footer, hidden on mobile */}
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
      
      {/* Footer - Fixed at bottom aligned with chat area */}
      <div className="flex flex-none">
        {/* Spacer for sidebar on desktop */}
        <div className={cn(
          "flex-none hidden lg:block transition-all duration-300",
          isSidebarCollapsed ? "w-12" : "w-80"
        )} />
        
        {/* Input aligned with chat content */}
        <div className="flex-1">
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
    </div>
  );
} 