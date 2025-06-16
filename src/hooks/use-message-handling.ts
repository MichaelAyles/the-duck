"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
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
  generateTitleIfNeeded: (messages: Message[], sessionId: string) => Promise<string | null>;
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
  const messagesRef = useRef<Message[]>(messages);

  // Keep messages ref up to date
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Generate title with new logic: try AI, fallback to existing title on failure
  const generateTitleIfNeeded = useCallback(async (messages: Message[], sessionId: string): Promise<string | null> => {
    // Filter out welcome message and empty messages
    const conversationMessages = messages.filter(msg => 
      msg.id !== "welcome-message" && 
      msg.metadata?.model !== "system" &&
      msg.content.trim()
    );
    
    const userMessages = conversationMessages.filter(msg => msg.role === 'user');
    
    // Only generate title if we have at least one user message
    if (userMessages.length >= 1) {
      try {
        const response = await fetch(API_ENDPOINTS.GENERATE_TITLE, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: conversationMessages,
            sessionId,
            preserveExistingOnFailure: true // New flag to preserve existing title on AI failure
          }),
        });

        if (response.ok) {
          const data = await response.json();
          console.log(`✅ Generated/updated title for session ${sessionId}:`, data.title);
          return data.title; // Return the new title
        } else {
          const errorText = await response.text();
          console.error(`❌ Failed to generate title for session ${sessionId}:`, response.status, response.statusText, errorText);
          return null; // Return null to indicate failure - existing title will be preserved
        }
      } catch (error) {
        console.error('Error generating title:', error);
        return null; // Return null to indicate failure
      }
    }
    
    return null; // No title generated
  }, []);

  const handleSendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: content.trim(),
      timestamp: new Date(),
    };

    const thinkingMessage: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      timestamp: new Date(),
      metadata: {
        model: settings.model,
        isThinking: true,
      },
    };

    // Use ref to get the most current messages and avoid stale closures
    const currentMessages = messagesRef.current;
    
    // Step 1: Remove welcome message and add user message + thinking message immediately
    const filteredMessages = currentMessages.filter(msg => msg.id !== "welcome-message");
    const newMessages = [...filteredMessages, userMessage, thinkingMessage];
    
    // Immediately show user message and thinking message
    setMessages(newMessages);
    setIsLoading(true);

    try {
      // Save chat session if storage is enabled and user is authenticated
      if (settings.storageEnabled && userId && sessionId) {
        try {
          // For first message: generate title before saving
          let titleToUse: string | undefined;
          const userMessages = newMessages.filter(msg => msg.role === 'user');
          
          // Save without the thinking message first
          const messagesToSave = [...filteredMessages, userMessage];
          await chatServiceRef.current?.saveChatSession(messagesToSave, settings.model, titleToUse);
          console.log(`✅ Successfully saved chat session with ${messagesToSave.length} messages`);
          
          // Generate title after saving for first message
          if (userMessages.length === 1) {
            try {
              await generateTitleIfNeeded(messagesToSave, sessionId);
            } catch (error) {
              console.warn('Failed to generate title after save:', error);
              // Don't fail the entire operation if title generation fails
            }
          }
        } catch (error) {
          console.error('Error saving chat session:', error);
          toast({
            title: "Save Warning",
            description: "Your message was sent but may not be saved to history.",
            variant: "destructive",
          });
        }
      }

      // Extract learning preferences when user expresses explicit preferences (only if storage enabled)
      if (sessionId && userId && settings.storageEnabled) {
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
                
                // Save final session and update title when response is complete
                if (sessionId && userId && settings.storageEnabled) {
                  setMessages(currentMessages => {
                    // Save the completed conversation
                    setTimeout(async () => {
                      try {
                        const userMessages = currentMessages.filter(msg => msg.role === 'user');
                        
                        // For consecutive messages (after first): try AI, keep existing if fails
                        if (userMessages.length > 1) {
                          const generatedTitle = await generateTitleIfNeeded(currentMessages, sessionId);
                          // Only save with new title if generation succeeded
                          if (generatedTitle) {
                            await chatServiceRef.current?.saveChatSession(currentMessages, settings.model, generatedTitle);
                            console.log(`✅ Final save with updated title: ${generatedTitle}`);
                          } else {
                            await chatServiceRef.current?.saveChatSession(currentMessages, settings.model);
                            console.log(`✅ Final save: chat session with ${currentMessages.length} messages (title preserved)`);
                          }
                        } else {
                          // First message was already saved with title above
                          await chatServiceRef.current?.saveChatSession(currentMessages, settings.model);
                          console.log(`✅ Final save: chat session with ${currentMessages.length} messages`);
                        }
                      } catch (error) {
                        console.error('Error saving final chat session:', error);
                      }
                    }, 100);
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
                      // If this is the first content chunk and we have a thinking message, replace it
                      if (lastMessage.metadata?.isThinking && !lastMessage.content) {
                        updated[lastMessageIndex] = {
                          ...lastMessage,
                          content: parsed.content,
                          metadata: {
                            ...lastMessage.metadata,
                            isThinking: false,
                          },
                        };
                      } else {
                        // Continue appending content for ongoing streams
                        updated[lastMessageIndex] = {
                          ...lastMessage,
                          content: lastMessage.content + parsed.content
                        };
                      }
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