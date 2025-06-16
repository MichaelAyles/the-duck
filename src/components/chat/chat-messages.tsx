"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { User, Loader2 } from "lucide-react";
import { Message } from "@/types/chat";
import { MessageContent } from "./message-content";
import { DuckLogo } from "@/components/duck-logo";
import { cn } from "@/lib/utils";

interface ChatMessagesProps {
  messages: Message[];
  isLoading: boolean;
}

export function ChatMessages({ messages, isLoading }: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [fadingWelcome, setFadingWelcome] = useState(false);
  const prevMessagesRef = useRef<Message[]>([]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Detect when welcome message should fade out
  useEffect(() => {
    const prevMessages = prevMessagesRef.current;
    const hasWelcomeMessage = messages.some(msg => msg.id === "welcome-message");
    const hadWelcomeMessage = prevMessages.some(msg => msg.id === "welcome-message");
    
    // If we had a welcome message but now don't, the transition just happened
    if (hadWelcomeMessage && !hasWelcomeMessage) {
      setFadingWelcome(true);
      
      // Reset fade state after animation
      setTimeout(() => {
        setFadingWelcome(false);
      }, 300);
    }
    
    prevMessagesRef.current = messages;
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
      <div className="max-w-4xl mx-auto space-y-4">
        {messages.map((message) => {
          const isWelcomeMessage = message.id === "welcome-message";
          const shouldFade = isWelcomeMessage && fadingWelcome;
          
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
              {message.role === "assistant" && (!message.content || message.metadata?.isThinking) && isLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">🦆 Thinking quack-tastically...</span>
                </div>
              ) : (
                <MessageContent content={message.content} />
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