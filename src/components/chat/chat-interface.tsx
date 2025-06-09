"use client";

import { useState, useEffect, useRef } from "react";
import { ChatHeader } from "./chat-header";
import { ChatMessages } from "./chat-messages";
import { ChatInput } from "./chat-input";
import { StorageIndicator } from "./storage-indicator";
import { cn } from "@/lib/utils";
import { ChatService } from '@/lib/chat-service'

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  metadata?: {
    model?: string;
    tokens?: number;
    processingTime?: number;
  };
}

export interface ChatSettings {
  model: string;
  tone: string;
  storageEnabled: boolean;
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [settings, setSettings] = useState<ChatSettings>({
    model: "openai/gpt-4o-mini",
    tone: "match-user",
    storageEnabled: true,
  });
  const [isProcessingStorage, setIsProcessingStorage] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const chatServiceRef = useRef<ChatService | null>(null);

  // Initialize session and chat service
  useEffect(() => {
    const newSessionId = crypto.randomUUID();
    setSessionId(newSessionId);
    
    chatServiceRef.current = new ChatService(newSessionId, async () => {
      if (messages.length > 1) { // Don't end if only welcome message
        await handleEndChat();
      }
    });

    return () => {
      chatServiceRef.current?.cleanup();
    };
  }, []);

  // Add welcome message
  useEffect(() => {
    if (messages.length === 0) {
      const welcomeMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "🦆 Hello! I'm The Duck, your friendly AI assistant. Ready to dive into some quack-tastic conversations? Whether you need help with questions, creative projects, or just want to chat, I'm here to make waves! What can I help you with today?",
        timestamp: new Date(),
        metadata: {
          model: "system",
        },
      };
      setMessages([welcomeMessage]);
    }
  }, [messages.length]);

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    // Update activity timer
    chatServiceRef.current?.updateActivity();

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: content.trim(),
      timestamp: new Date(),
    };

    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      timestamp: new Date(),
      metadata: {
        model: settings.model,
      },
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setIsLoading(true);

    try {
      // Save chat session if storage is enabled
      if (settings.storageEnabled) {
        await chatServiceRef.current?.saveChatSession([...messages, userMessage], settings.model);
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(msg => ({
            role: msg.role,
            content: msg.content,
          })),
          model: settings.model,
          stream: true,
          tone: settings.tone,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send message');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              if (data === '[DONE]') {
                setIsLoading(false);
                return;
              }

              try {
                const parsed = JSON.parse(data);
                if (parsed.error) {
                  throw new Error(parsed.error);
                }
                
                if (parsed.content) {
                  setMessages(prev => {
                    const updated = [...prev];
                    const lastMessage = updated[updated.length - 1];
                    if (lastMessage && lastMessage.role === 'assistant') {
                      lastMessage.content += parsed.content;
                    }
                    return updated;
                  });
                }
              } catch (e) {
                // Skip invalid JSON lines
                continue;
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      setIsLoading(false);
      console.error("Error sending message:", error);
      
      setMessages(prev => {
        const updated = prev.slice(0, -1);
        return [
          ...updated,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `I apologize, but I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
            timestamp: new Date(),
            metadata: {
              model: settings.model,
            },
          },
        ];
      });
    }
  };

  const handleEndChat = async () => {
    if (messages.length <= 1) return; // Don't end if only welcome message

    setIsProcessingStorage(true);
    
    try {
      if (settings.storageEnabled) {
        // Summarize chat and store preferences
        await chatServiceRef.current?.summarizeChat(messages);
      }
      
      // Reset chat
      setMessages([]);
      const newSessionId = crypto.randomUUID();
      setSessionId(newSessionId);
      chatServiceRef.current = new ChatService(newSessionId, async () => {
        if (messages.length > 1) {
          await handleEndChat();
        }
      });
    } catch (error) {
      console.error("Error ending chat:", error);
    } finally {
      setIsProcessingStorage(false);
    }
  };

  const handleSettingsChange = (newSettings: Partial<ChatSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <ChatHeader
        settings={settings}
        onSettingsChange={handleSettingsChange}
        onEndChat={handleEndChat}
        messageCount={messages.length - 1} // Exclude welcome message
      />
      
      <div
        className={cn(
          "flex-1 transition-all duration-300 relative",
          settings.storageEnabled
            ? "bg-transparent"
            : "bg-muted/20"
        )}
      >
        {/* Decorative duck waves pattern */}
        <div className="absolute inset-0 opacity-5 pointer-events-none">
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-primary/20 to-transparent"></div>
          <div className="absolute bottom-8 left-0 right-0 h-2 bg-primary/10 rounded-full"></div>
          <div className="absolute bottom-16 left-8 right-8 h-1 bg-primary/15 rounded-full"></div>
        </div>
        
        <ChatMessages
          messages={messages}
          isLoading={isLoading}
        />
      </div>
      
      <ChatInput
        onSendMessage={handleSendMessage}
        disabled={isLoading}
        storageEnabled={settings.storageEnabled}
      />
      
      <StorageIndicator
        isVisible={isProcessingStorage}
        message="🦆 Processing chat summary and storing preferences..."
      />
    </div>
  );
}