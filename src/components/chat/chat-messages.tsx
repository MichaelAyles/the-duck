"use client";

import { useEffect, useRef } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { User, Loader2 } from "lucide-react";
import { Message } from "./chat-interface";
import { MessageContent } from "./message-content";
import { DuckLogo } from "@/components/duck-logo";
import { cn } from "@/lib/utils";

interface ChatMessagesProps {
  messages: Message[];
  isLoading: boolean;
}

export function ChatMessages({ messages, isLoading }: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div className="max-w-4xl mx-auto space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex gap-3",
              message.role === "user" ? "justify-end" : "justify-start"
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
                  : "bg-card hover:bg-card/80"
              )}
            >
              <MessageContent content={message.content} />
              
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
        ))}
        
        {isLoading && (
          <div className="flex gap-3 justify-start">
            <Avatar className="h-9 w-9 mt-1 duck-shadow animate-pulse">
              <AvatarFallback className="duck-gradient border-2 border-background">
                <DuckLogo size="sm" />
              </AvatarFallback>
            </Avatar>
            
            <Card className="max-w-[80%] p-4 bg-card duck-shadow animate-pulse">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">🦆 Thinking quack-tastically...</span>
              </div>
            </Card>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}