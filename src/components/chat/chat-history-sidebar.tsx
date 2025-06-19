"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  MessageSquare, 
  Search, 
  Trash2, 
  Plus, 
  Clock,
  MoreVertical,
  Loader2,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/auth-provider";
import { useToast } from "@/hooks/use-toast";

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  messageCount: number;
  lastMessage: string;
  firstUserMessage: string;
  model: string;
  preview: string;
}

interface ChatHistorySidebarProps {
  currentSessionId?: string;
  onSessionSelect: (sessionId: string) => void;
  onNewChat: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  className?: string;
  refreshTrigger?: number; // Added to trigger refresh when sessions change
}

export const ChatHistorySidebar = React.memo(function ChatHistorySidebar({
  currentSessionId,
  onSessionSelect,
  onNewChat,
  isCollapsed = false,
  onToggleCollapse,
  className,
  refreshTrigger
}: ChatHistorySidebarProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isGeneratingTitle, setIsGeneratingTitle] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  // Fetch chat history with optional search
  const fetchChatHistory = useCallback(async (search = "") => {
    if (!user) return;

    try {
      setIsSearching(!!search);
      
      if (search && search.length >= 2) {
        // Use the new full-text search endpoint
        const params = new URLSearchParams();
        params.append('q', search);
        params.append('limit', '50');

        const response = await fetch(`/api/search-messages?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error('Failed to search messages');
        }

        const data = await response.json();
        
        // Convert search results to session format
        const searchSessions: ChatSession[] = data.results.map((result: {
          session_id: string;
          session_title: string;
          session_created_at: string;
          session_model: string;
          matching_messages: Array<{ role: string; content: string; snippet: string }>;
        }) => ({
          id: result.session_id,
          title: result.session_title,
          createdAt: result.session_created_at,
          updatedAt: result.session_created_at,
          isActive: false,
          messageCount: result.matching_messages.length,
          lastMessage: result.matching_messages[0]?.snippet || '',
          firstUserMessage: result.matching_messages.find((m) => m.role === 'user')?.snippet || '',
          model: result.session_model,
          preview: result.matching_messages.map((m) => m.snippet).join(' | ')
        }));
        
        setSessions(searchSessions);
      } else {
        // Use regular chat history endpoint
        const params = new URLSearchParams();
        params.append('limit', '50');
        
        const response = await fetch(`/api/chat-history?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch chat history');
        }

        const data = await response.json();
        setSessions(data.sessions || []);
      }
    } catch (error) {
      console.error('Error fetching chat history:', error);
      toast({
        title: "Error",
        description: search ? "Failed to search messages" : "Failed to load chat history",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setIsSearching(false);
    }
  }, [user, toast]);

  // Initial load and refresh trigger
  useEffect(() => {
    fetchChatHistory();
  }, [fetchChatHistory, refreshTrigger]);

  // Search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery !== "") {
        fetchChatHistory(searchQuery);
      } else {
        fetchChatHistory();
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, fetchChatHistory]);

  // Generate title for a session
  const generateTitle = async (sessionId: string) => {
    setIsGeneratingTitle(sessionId);
    
    try {
      // First fetch the session to get its messages
      const sessionResponse = await fetch(`/api/sessions/${sessionId}`);
      
      if (!sessionResponse.ok) {
        throw new Error('Failed to fetch session');
      }
      
      const sessionData = await sessionResponse.json();
      const messages = sessionData.session?.messages || [];
      
      // Now generate the title with the actual messages
      const response = await fetch('/api/generate-title', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages,
          sessionId
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate title');
      }

      const data = await response.json();
      
      // Update the session title in the list
      setSessions(prev => prev.map(session => 
        session.id === sessionId 
          ? { ...session, title: data.title }
          : session
      ));

      toast({
        title: "Title Generated",
        description: `New title: "${data.title}"`,
      });

    } catch (error) {
      console.error('Error generating title:', error);
      toast({
        title: "Error",
        description: "Failed to generate title",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingTitle(null);
    }
  };

  // Delete a session
  const deleteSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/chat-history?sessionId=${sessionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete session');
      }

      setSessions(prev => prev.filter(session => session.id !== sessionId));
      
      toast({
        title: "Chat Deleted",
        description: "Chat session has been deleted",
      });

      // If deleted session was current, start new chat
      if (sessionId === currentSessionId) {
        onNewChat();
      }

    } catch (error) {
      console.error('Error deleting session:', error);
      toast({
        title: "Error",
        description: "Failed to delete chat session",
        variant: "destructive",
      });
    }
  };

  // Format date for display - memoized for performance
  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 5) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  }, []);

  // Memoize filtered sessions for performance
  // Note: When searchQuery is present and >= 2 chars, sessions already contain search results
  const filteredSessions = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return sessions;
    // For search queries < 2 characters, filter client-side
    if (searchQuery.length === 1) {
      return sessions.filter(session => 
        session.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        session.preview.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    // For search queries >= 2 characters, sessions already contain filtered results from API
    return sessions;
  }, [sessions, searchQuery]);

  if (!user) {
    return null;
  }

  return (
    <div className={cn(
      "flex flex-col bg-background/95 backdrop-blur-md border-r border-border/50 transition-all duration-300 shadow-lg h-full",
      isCollapsed ? "w-12" : "w-80",
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/30 bg-gradient-to-r from-primary/5 to-transparent">
        {!isCollapsed && (
          <>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              <span className="font-semibold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">Chat History</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onNewChat}
              className="bg-primary/10 hover:bg-primary/20 text-primary hover:text-primary shadow-sm hover:shadow-md transition-all duration-300 rounded-lg"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </>
        )}
        
        {onToggleCollapse && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleCollapse}
            className={cn(
              "bg-secondary/30 hover:bg-secondary/50 shadow-sm hover:shadow-md transition-all duration-300 rounded-lg",
              isCollapsed && "w-full"
            )}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        )}
      </div>

      {!isCollapsed && (
        <>
          {/* Search */}
          <div className="p-4 pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search messages and conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-background/50 border-border/30 shadow-sm focus:shadow-md focus:ring-primary/20 transition-all duration-300 rounded-lg"
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-primary" />
              )}
            </div>
            {searchQuery && searchQuery.length >= 2 && (
              <p className="text-xs text-muted-foreground mt-1 px-1">
                🔍 Full-text search across all messages
              </p>
            )}
          </div>

          {/* Sessions List */}
          <ScrollArea className="flex-1 px-2 min-h-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  {searchQuery ? "No conversations found" : "No conversations yet"}
                </p>
                {!searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onNewChat}
                    className="mt-2"
                  >
                    Start your first chat
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-1 pb-4">
                {filteredSessions.map((session) => (
                  <div
                    key={session.id}
                    className={cn(
                      "group relative rounded-xl p-3 cursor-pointer transition-all duration-300 border backdrop-blur-sm",
                      session.id === currentSessionId
                        ? "bg-gradient-to-r from-primary/15 to-primary/10 border-primary/30 shadow-md ring-1 ring-primary/20"
                        : "border-transparent hover:bg-gradient-to-r hover:from-secondary/30 hover:to-secondary/20 hover:border-border/30 hover:shadow-sm"
                    )}
                    onClick={() => onSessionSelect(session.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-sm truncate">
                            {session.title}
                          </h3>
                          {session.isActive && (
                            <div className="w-2 h-2 bg-green-500 rounded-full" />
                          )}
                        </div>
                        
                        <p className="text-xs text-muted-foreground truncate mb-2">
                          {session.preview}
                        </p>
                        
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>{formatDate(session.updatedAt)}</span>
                          </div>
                          <span>{session.messageCount} messages</span>
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {isGeneratingTitle === session.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <MoreVertical className="h-3 w-3" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation();
                              generateTitle(session.id);
                            }}
                            disabled={isGeneratingTitle === session.id}
                          >
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Regenerate Title
                          </DropdownMenuItem>
                          <Separator />
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSession(session.id);
                            }}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </>
      )}
    </div>
  );
}); 