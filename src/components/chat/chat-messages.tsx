"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { User, Loader2 } from "lucide-react";
import { Message } from "@/types/chat";
import { MessageContent } from "./message-content";
import { DuckLogo } from "@/components/duck-logo";
import { cn } from "@/lib/utils";
import { FilePreview } from "./file-preview";
import type { FileUpload } from "@/types/file-upload";

interface ChatMessagesProps {
  messages: Message[];
  isLoading: boolean;
  userId?: string;
  sessionId?: string;
}

export function ChatMessages({ messages, isLoading, userId, sessionId }: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [fadingWelcome, setFadingWelcome] = useState(false);
  const prevMessagesRef = useRef<Message[]>([]);

  // Debug logging for message changes (only in development)
  const debugMessages = useMemo(() => {
    if (process.env.NODE_ENV !== 'development') return [];
    return messages.map(m => ({ 
      id: m.id, 
      role: m.role, 
      content: m.content.slice(0, 20), 
      isThinking: m.metadata?.isThinking 
    }));
  }, [messages]);
  
  if (process.env.NODE_ENV === 'development' && debugMessages.length > 0) {
    console.log('ChatMessages render - messages:', debugMessages, 'isLoading:', isLoading);
  }

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  // Detect when welcome message should fade out
  useEffect(() => {
    const prevMessages = prevMessagesRef.current;
    const hasWelcomeMessage = messages.some(msg => msg.id === "welcome-message");
    const hadWelcomeMessage = prevMessages.some(msg => msg.id === "welcome-message");
    
    // If we had a welcome message but now don't, OR if we have non-welcome messages now when we didn't before
    const hasNonWelcomeMessages = messages.some(msg => msg.id !== "welcome-message");
    const hadNonWelcomeMessages = prevMessages.some(msg => msg.id !== "welcome-message");
    
    // Trigger fade when welcome message should disappear (either removed or new messages added)
    if ((hadWelcomeMessage && !hasWelcomeMessage) || 
        (hasWelcomeMessage && hasNonWelcomeMessages && !hadNonWelcomeMessages)) {
      if (process.env.NODE_ENV === 'development') {
        console.log('Triggering welcome message fade');
      }
      setFadingWelcome(true);
      
      // Reset fade state after animation
      const timer = setTimeout(() => {
        setFadingWelcome(false);
      }, 300);
      
      // Store timer for cleanup
      return () => clearTimeout(timer);
    }
    
    // Only update ref if messages actually changed (prevent unnecessary updates)
    if (prevMessages !== messages) {
      prevMessagesRef.current = messages;
    }
  }, [messages]);

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <div className="max-w-4xl mx-auto space-y-4">
        {messages.map((message) => {
          const isWelcomeMessage = message.id === "welcome-message";
          const shouldFade = isWelcomeMessage && fadingWelcome;
          const shouldShowThinking = message.role === "assistant" && message.metadata?.isThinking && !message.content && isLoading;
          
          // Remove render-time logging to prevent infinite loops
          
          return (
            <div
              key={message.id}
              className={cn(
                "flex gap-3 transition-all duration-300",
                message.role === "user" ? "justify-end" : "justify-start",
                shouldFade && "opacity-0 -translate-y-4 scale-95"
              )}
            >
            {message.role === "assistant" && (
              <Avatar className="h-9 w-9 mt-1 duck-shadow hover:duck-glow transition-all duration-300">
                <AvatarFallback className="duck-gradient border-2 border-background">
                  <DuckLogo size="sm" />
                </AvatarFallback>
              </Avatar>
            )}
            
            <Card
              className={cn(
                "max-w-[80%] p-4 transition-all duration-300 duck-shadow",
                message.role === "user"
                  ? "duck-gradient text-primary-foreground ml-12 hover:duck-glow"
                  : "bg-card hover:bg-card/80",
                message.role === "assistant" && !message.content && isLoading && "animate-pulse"
              )}
            >
              {shouldShowThinking ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Working on your response...</span>
                </div>
              ) : (
                <>
                  <MessageContent 
                    content={message.content} 
                    message={message}
                    userId={userId}
                    sessionId={sessionId}
                  />
                  {message.attachments && message.attachments.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {message.attachments.map((attachment) => (
                        <FilePreview
                          key={attachment.id}
                          file={attachment as FileUpload}
                          url={attachment.url}
                          compact
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
              
              {message.metadata && (
                <div className="mt-2 pt-2 border-t border-border/50">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {message.metadata.model && message.metadata.model !== "system" && (
                      <span>{message.metadata.model}</span>
                    )}
                    {message.metadata.tokens && (
                      <span>• {message.metadata.tokens} tokens</span>
                    )}
                    {message.metadata.processingTime && (
                      <span>• {message.metadata.processingTime}ms</span>
                    )}
                  </div>
                </div>
              )}
            </Card>
            
            {message.role === "user" && (
              <Avatar className="h-9 w-9 mt-1 duck-shadow hover:duck-glow transition-all duration-300">
                <AvatarFallback className="bg-secondary border-2 border-background">
                  <User className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
            )}
            </div>
          );
        })}
        
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}