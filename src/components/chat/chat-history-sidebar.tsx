"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  MessageSquare, 
  Search, 
  Trash2, 
  Plus, 
  Calendar,
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

export function ChatHistorySidebar({
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

  // Fetch chat history
  const fetchChatHistory = useCallback(async (search = "") => {
    if (!user) return;

    try {
      setIsSearching(!!search);
      const params = new URLSearchParams();
      params.append('limit', '50');
      if (search) params.append('search', search);

      const response = await fetch(`/api/chat-history?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch chat history');
      }

      const data = await response.json();
      setSessions(data.sessions || []);
    } catch (error) {
      console.error('Error fetching chat history:', error);
      toast({
        title: "Error",
        description: "Failed to load chat history",
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
  const generateTitle = async (sessionId: string, messages: any[]) => {
    setIsGeneratingTitle(sessionId);
    
    try {
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

  // Format date for display
  const formatDate = (dateString: string) => {
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
  };

  if (!user) {
    return null;
  }

  return (
    <div className={cn(
      "flex flex-col h-full bg-background border-r border-border transition-all duration-300",
      isCollapsed ? "w-12" : "w-80",
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        {!isCollapsed && (
          <>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              <span className="font-semibold">Chat History</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onNewChat}
              className="duck-shadow hover:duck-glow"
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
              "duck-shadow hover:duck-glow",
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
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 duck-shadow focus:duck-glow"
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
          </div>

          {/* Sessions List */}
          <ScrollArea className="flex-1 px-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : sessions.length === 0 ? (
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
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className={cn(
                      "group relative rounded-lg p-3 cursor-pointer transition-all duration-200 border",
                      session.id === currentSessionId
                        ? "bg-primary/10 border-primary/20 duck-glow"
                        : "border-transparent hover:bg-muted/50 hover:border-border duck-shadow"
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
                              // This would need access to the actual messages
                              // For now, we'll show a placeholder
                              generateTitle(session.id, []);
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
} 