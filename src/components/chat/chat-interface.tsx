"use client";

import { useState, useEffect } from "react";
import { ChatHeader } from "./chat-header";
import { ChatMessages } from "./chat-messages";
import { ChatInput } from "./chat-input";
import { StorageIndicator } from "./storage-indicator";
import { cn } from "@/lib/utils";

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

  // Initialize session
  useEffect(() => {
    const newSessionId = crypto.randomUUID();
    setSessionId(newSessionId);
  }, []);

  // Add welcome message
  useEffect(() => {
    if (messages.length === 0) {
      const welcomeMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Hello! I'm Aura, your AI assistant. I'm here to help you with any questions or tasks you might have. How can I assist you today?",
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
      
      // Remove the empty assistant message and show error
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
      // TODO: Implement chat summarization and storage
      await new Promise((resolve) => setTimeout(resolve, 2000));
      
      // Reset chat
      setMessages([]);
      setSessionId(crypto.randomUUID());
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
    <div className="flex flex-col h-screen">
      <ChatHeader
        settings={settings}
        onSettingsChange={handleSettingsChange}
        onEndChat={handleEndChat}
        messageCount={messages.length - 1} // Exclude welcome message
      />
      
      <div
        className={cn(
          "flex-1 transition-colors duration-300",
          settings.storageEnabled
            ? "bg-background"
            : "bg-muted/30"
        )}
      >
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
        message="Processing chat summary and storing preferences..."
      />
    </div>
  );
}