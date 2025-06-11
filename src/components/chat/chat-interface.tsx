"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { ChatHeader } from "./chat-header";
import { ChatMessages } from "./chat-messages";
import { ChatInput } from "./chat-input";
import { StorageIndicator } from "./storage-indicator";
import { cn } from "@/lib/utils";
import { ChatService } from '@/lib/chat-service'
import { useAuth } from "@/components/auth/auth-provider"
import { useModels } from "@/hooks/use-models"

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

interface ChatInterfaceProps {
  sessionId?: string | null;
  initialMessages?: Message[];
  isLoading?: boolean;
  onSessionUpdate?: (sessionId: string, newMessages: Message[]) => void;
}

export const ChatInterface = React.memo(({ 
  sessionId: initialSessionId, 
  initialMessages,
  isLoading: isPageLoading,
  onSessionUpdate 
}: ChatInterfaceProps = {}) => {
  const [messages, setMessages] = useState<Message[]>(initialMessages || []);
  const [isLoading, setIsLoading] = useState(isPageLoading || false);
  const [settings, setSettings] = useState<ChatSettings>({
    model: "google/gemini-2.5-flash-preview-05-20", // Start with Flash, will be updated with user's primary model
    tone: "match-user",
    storageEnabled: true,
  });
  const [isProcessingStorage, setIsProcessingStorage] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId || null);
  const chatServiceRef = useRef<ChatService | null>(null);
  const { user } = useAuth();
  const { primaryModel, setPrimary, isStarred } = useModels();

  // Update model setting when primary model is loaded
  useEffect(() => {
    if (primaryModel && primaryModel !== settings.model) {
      console.log('Updating model setting to primary model:', primaryModel);
      setSettings(prev => ({ ...prev, model: primaryModel }));
    }
  }, [primaryModel, settings.model]);

  // Load messages for an existing session
  const loadSessionMessages = useCallback(async (sessionId: string) => {
    try {
      if (!user || !chatServiceRef.current) return;
      
      console.log('Loading session messages for:', sessionId);
      
      // Load messages using ChatService
      const loadedMessages = await chatServiceRef.current.loadChatSession();
      
      if (loadedMessages && loadedMessages.length > 0) {
        // Convert loaded messages to proper format with dates
        const formattedMessages = loadedMessages.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
        
        setMessages(formattedMessages);
        console.log(`Loaded ${formattedMessages.length} messages for session ${sessionId}`);
      } else {
        // If no messages found, show welcome message
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
        console.log('No messages found, showing welcome message');
      }
    } catch (error) {
      console.error('Error loading session messages:', error);
      // On error, show welcome message
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
  }, [user]);

  // Handle session changes - this effect runs when the sessionId prop changes
  useEffect(() => {
    console.log('SessionId changed to:', initialSessionId);
    if (initialSessionId && initialSessionId !== sessionId) {
      // Session changed, update our state and load new messages
      setSessionId(initialSessionId);
      
      // Create new ChatService for the new session
      if (user) {
        chatServiceRef.current = new ChatService(initialSessionId, user.id);
        loadSessionMessages(initialSessionId);
      }
    }
  }, [initialSessionId, sessionId, user, loadSessionMessages]);

  // When initialMessages changes, update our state
  useEffect(() => {
    if (initialMessages) {
      setMessages(initialMessages);
    }
  }, [initialMessages]);

  // When page loading state changes, update our state
  useEffect(() => {
    if (isPageLoading !== undefined) {
      setIsLoading(isPageLoading);
    }
  }, [isPageLoading]);

  // Generate title after a few messages
  const generateTitleIfNeeded = useCallback(async (messages: Message[], sessionId: string) => {
    // Generate title after user sends 2nd message (to have some context)
    const userMessages = messages.filter(msg => msg.role === 'user');
    if (userMessages.length === 2) {
      try {
        const response = await fetch('/api/generate-title', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: messages.slice(0, 6), // First few messages for context
            sessionId
          }),
        });

        if (response.ok) {
          const data = await response.json();
          console.log('Generated title:', data.title);
          // The title will be updated in the database automatically
          // and the sidebar will refresh to show the new title
        }
      } catch (error) {
        console.error('Error generating title:', error);
      }
    }
  }, []);

  // Define handleEndChat first so it can be used in useEffect
  const handleEndChat = useCallback(async () => {
    if (messages.length <= 1) return; // Don't end if only welcome message

    setIsProcessingStorage(true);
    
    try {
      if (settings.storageEnabled && user) {
        // Summarize chat and store preferences
        await chatServiceRef.current?.summarizeChat(messages);
      }
      
      // Reset chat
      setMessages([]);
      const newSessionId = crypto.randomUUID();
      setSessionId(newSessionId);
      // Create new chat service
      chatServiceRef.current = new ChatService(newSessionId, user?.id);
      
      // Notify parent about session change
      if (onSessionUpdate) {
        onSessionUpdate(newSessionId, []);
      }
      
      // Setup inactivity handler
      chatServiceRef.current.setupInactivityHandler(async () => {
        if (messages.length > 1) {
          await handleEndChat();
        }
      });
    } catch (error) {
      console.error("Error ending chat:", error);
    } finally {
      setIsProcessingStorage(false);
    }
  }, [messages, settings.storageEnabled, onSessionUpdate, user]);

  // Initialize session and chat service
  useEffect(() => {
    const currentSessionId = initialSessionId || crypto.randomUUID();
    setSessionId(currentSessionId);
    
    chatServiceRef.current = new ChatService(currentSessionId, user?.id);
    
    // Setup inactivity handler
    chatServiceRef.current.setupInactivityHandler(async () => {
      if (messages.length > 1) { // Don't end if only welcome message
        await handleEndChat();
      }
    });

    // Load messages for the session
    if (user) {
      if (initialSessionId && !initialMessages?.length) {
        // Load existing session messages if not already provided
        loadSessionMessages(initialSessionId);
      } else if (!initialSessionId) {
        // New session - clear messages to trigger welcome message
        setMessages([]);
      }
    } else {
      // No user - show welcome message
      setMessages([]);
    }

    return () => {
      chatServiceRef.current?.clearInactivityTimer();
    };
  }, [initialSessionId, user?.id, loadSessionMessages, handleEndChat, initialMessages?.length, messages.length, user]);

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

    // Reset inactivity timer
    chatServiceRef.current?.setupInactivityHandler(async () => {
      if (messages.length > 1) {
        await handleEndChat();
      }
    });

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

    const newMessages = [...messages, userMessage, assistantMessage];

    setMessages(newMessages);
    setIsLoading(true);

    try {
      // Save chat session if storage is enabled and user is authenticated
      if (settings.storageEnabled && user) {
        await chatServiceRef.current?.saveChatSession(newMessages, settings.model);
      }

      // Generate title after a few messages if we have a session and user
      if (sessionId && user) {
        generateTitleIfNeeded(newMessages, sessionId);
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: newMessages.map(msg => ({
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
              } catch {
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

    if (onSessionUpdate && sessionId) {
      const updatedMessages = [...newMessages, assistantMessage]
      onSessionUpdate(sessionId, updatedMessages)
      setMessages(updatedMessages)
    } else {
      setMessages(prevMessages => [...prevMessages, assistantMessage]);
    }

    setIsLoading(false);
  };

  const handleSettingsChange = async (newSettings: Partial<ChatSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
    
    // If model is being changed, update the primary model if it's a starred model
    if (newSettings.model && newSettings.model !== settings.model) {
      try {
        // Check if the new model is starred, and if so, set it as primary
        if (isStarred?.(newSettings.model)) {
          console.log('Setting new primary model:', newSettings.model);
          await setPrimary?.(newSettings.model);
        }
      } catch (error) {
        console.error('Error setting primary model:', error);
      }
    }
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
});

ChatInterface.displayName = 'ChatInterface';