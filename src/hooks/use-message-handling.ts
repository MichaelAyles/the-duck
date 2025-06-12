"use client";

import { useState, useCallback, useRef } from 'react';
import { ChatService } from '@/lib/chat-service';
import { Message } from '@/types/chat';
import { ChatSettings } from '@/components/chat/chat-interface';
import { useToast } from '@/hooks/use-toast';
import { API_ENDPOINTS } from '@/lib/config';

interface UseMessageHandlingProps {
  sessionId: string | null;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  settings: ChatSettings;
  chatServiceRef: React.MutableRefObject<ChatService | null>;
  userId?: string;
  onSessionUpdate?: (sessionId: string, newMessages: Message[]) => void;
}

interface UseMessageHandlingReturn {
  isLoading: boolean;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  handleSendMessage: (content: string) => Promise<void>;
  generateTitleIfNeeded: (messages: Message[], sessionId: string) => Promise<void>;
}

export function useMessageHandling({
  sessionId,
  messages,
  setMessages,
  settings,
  chatServiceRef,
  userId,
  onSessionUpdate,
}: UseMessageHandlingProps): UseMessageHandlingReturn {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const lastSummarizeTime = useRef<number>(0);

  // Generate/update title for every message exchange
  const generateTitleIfNeeded = useCallback(async (messages: Message[], sessionId: string) => {
    // Filter out welcome message and empty messages
    const conversationMessages = messages.filter(msg => 
      msg.id !== "welcome-message" && 
      msg.metadata?.model !== "system" &&
      msg.content.trim()
    );
    
    const userMessages = conversationMessages.filter(msg => msg.role === 'user');
    const assistantMessages = conversationMessages.filter(msg => msg.role === 'assistant' && msg.content.trim());
    
    // Generate title after we have at least one complete exchange (user + assistant response)
    // or when we have multiple user messages
    if (userMessages.length >= 1 && (assistantMessages.length >= 1 || userMessages.length >= 2)) {
      try {
        const response = await fetch(API_ENDPOINTS.GENERATE_TITLE, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: conversationMessages, // Use full conversation context
            sessionId
          }),
        });

        if (response.ok) {
          const data = await response.json();
          console.log('Generated/updated title:', data.title);
          // The title will be updated in the database automatically
          // and the sidebar will refresh to show the new title
        } else {
          console.error('Failed to generate title:', response.status, response.statusText);
        }
      } catch (error) {
        console.error('Error generating title:', error);
        // Title generation is not critical, so we don't show toast for this error
      }
    }
  }, []);

  const handleSendMessage = useCallback(async (content: string) => {
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

    const newMessages = [...messages, userMessage, assistantMessage];

    setMessages(newMessages);
    setIsLoading(true);

    try {
      // Save chat session if storage is enabled and user is authenticated
      if (settings.storageEnabled && userId) {
        try {
          await chatServiceRef.current?.saveChatSession(newMessages, settings.model);
        } catch (error) {
          console.error('Error saving chat session:', error);
          toast({
            title: "Save Warning",
            description: "Your message was sent but may not be saved to history.",
            variant: "destructive",
          });
        }
      }

      // Generate title after a few messages if we have a session and user
      if (sessionId && userId) {
        generateTitleIfNeeded(newMessages, sessionId);
        
        // Extract learning preferences when user expresses explicit preferences
        const hasPreferenceKeywords = /\b(like|love|enjoy|prefer|hate|dislike|don't like|interested in|fascinated by|passionate about)\b/i.test(content);
        const now = Date.now();
        
        // Throttle summarization to once every 30 seconds to allow accumulation of preferences
        if (hasPreferenceKeywords && (now - lastSummarizeTime.current) > 30000) {
          lastSummarizeTime.current = now;
          try {
            await fetch('/api/summarize', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                messages: newMessages.slice(0, -1), // All messages except empty assistant message
                sessionId
              }),
            });
            console.log('🧠 Learning preferences updated from full conversation context');
          } catch (error) {
            console.warn('Failed to extract learning preferences:', error);
          }
        }
      }

      const response = await fetch(API_ENDPOINTS.CHAT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: (() => {
            const filteredMessages = newMessages
              .slice(0, -1) // Remove the empty assistant message we just added
              .filter(msg => msg.content.trim()) // Filter out empty messages
              .filter(msg => msg.id !== "welcome-message") // Filter out welcome message
              .filter(msg => msg.metadata?.model !== "system") // Filter out system messages
              .map(msg => ({
                role: msg.role,
                content: msg.content,
              }));
            
            // Safety check: ensure we have at least one message
            if (filteredMessages.length === 0) {
              throw new Error('No valid messages to send');
            }
            
            return filteredMessages;
          })(),
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
                
                // Generate title when response is complete
                if (sessionId && userId) {
                  setMessages(currentMessages => {
                    // Trigger title generation with the completed conversation
                    setTimeout(() => generateTitleIfNeeded(currentMessages, sessionId), 100);
                    return currentMessages;
                  });
                }
                
                // Notify parent of session update when streaming completes
                if (onSessionUpdate && sessionId) {
                  setMessages(currentMessages => {
                    setTimeout(() => onSessionUpdate(sessionId, currentMessages), 0);
                    return currentMessages;
                  });
                }
                return;
              }

              if (!data) continue; // Skip empty data lines

              try {
                const parsed = JSON.parse(data);
                if (parsed.error) {
                  throw new Error(parsed.error);
                }
                
                if (parsed.content && typeof parsed.content === 'string') {
                  setMessages(prev => {
                    const updated = [...prev];
                    const lastMessageIndex = updated.length - 1;
                    const lastMessage = updated[lastMessageIndex];
                    if (lastMessage && lastMessage.role === 'assistant') {
                      // Create a new message object instead of mutating
                      updated[lastMessageIndex] = {
                        ...lastMessage,
                        content: lastMessage.content + parsed.content
                      };
                    }
                    return updated;
                  });
                }
              } catch (parseError) {
                console.warn('Failed to parse streaming data:', data, parseError);
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
      
      // Show user-friendly error toast
      toast({
        title: "Message Failed",
        description: error instanceof Error ? error.message : 'Failed to send message. Please try again.',
        variant: "destructive",
      });
      
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

    setIsLoading(false);
  }, [
    isLoading,
    messages,
    settings,
    userId,
    sessionId,
    chatServiceRef,
    generateTitleIfNeeded,
    onSessionUpdate,
    setMessages,
    toast,
  ]);

  return {
    isLoading,
    setIsLoading,
    handleSendMessage,
    generateTitleIfNeeded,
  };
}