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
  handleSendMessage: (content: string) => void;
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
          if (process.env.NODE_ENV === 'development') {
            if (process.env.NODE_ENV === 'development') console.log(`Generated/updated title for session ${sessionId}:`, data.title);
          }
          return data.title; // Return the new title
        } else {
          const errorText = await response.text();
          console.error(`Failed to generate title for session ${sessionId}:`, response.status, response.statusText, errorText);
          return null; // Return null to indicate failure - existing title will be preserved
        }
      } catch (error) {
        console.error('Error generating title:', error);
        return null; // Return null to indicate failure
      }
    }
    
    return null; // No title generated
  }, []);

  const handleSendMessage = useCallback((content: string) => {
    const startTime = performance.now();
    if (process.env.NODE_ENV === 'development') {
      if (process.env.NODE_ENV === 'development') console.log(`🚀 [${new Date().toISOString()}] handleSendMessage called`);
    }
    if (!content.trim() || isLoading) return;

    if (process.env.NODE_ENV === 'development') {
      if (process.env.NODE_ENV === 'development') console.log(`🚀 [${new Date().toISOString()}] Creating user and thinking messages`);
    }
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

    // Track when thinking started for minimum display time
    const thinkingStartTime = Date.now();

    // Use ref to get the most current messages and avoid stale closures
    const currentMessages = messagesRef.current;
    if (process.env.NODE_ENV === 'development') {
      console.log('📋 Current messages before filtering:', currentMessages.map(m => ({ id: m.id, role: m.role, content: m.content.slice(0, 20) })));
      console.log('🚀 About to update UI with messages');
    }
    
    // IMMEDIATELY update UI - no awaits, no blocking
    const filteredMessages = currentMessages.filter(msg => msg.id !== "welcome-message");
    
    if (process.env.NODE_ENV === 'development') {
      console.log('📋 Filtered messages (no welcome):', filteredMessages.map(m => ({ id: m.id, role: m.role, content: m.content.slice(0, 20) })));
    }
    
    const newMessages = [...filteredMessages, userMessage, thinkingMessage];
    
    if (process.env.NODE_ENV === 'development') {
      console.log('📋 New messages array to set:', newMessages.map(m => ({ id: m.id, role: m.role, content: m.content.slice(0, 20), isThinking: m.metadata?.isThinking })));
    }
    
    // Update the ref immediately to ensure consistency
    messagesRef.current = newMessages;
    
    // Update state immediately without flushSync
    if (process.env.NODE_ENV === 'development') console.log(`⚡ [${new Date().toISOString()}] Updating messages and loading state`);
    setMessages(newMessages);
    setIsLoading(true);
    const updateTime = performance.now() - startTime;
    if (process.env.NODE_ENV === 'development') console.log(`[${new Date().toISOString()}] State updated - took ${updateTime.toFixed(2)}ms`);

    // Fire and forget: run all background operations asynchronously
    (async () => {

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
          if (process.env.NODE_ENV === 'development') console.log(`Successfully saved chat session with ${messagesToSave.length} messages`);
          
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
          console.error('❌ CRITICAL: Failed to save chat session:', error);
          
          // Stop the chat flow when session saving fails
          setIsLoading(false);
          
          // Remove the thinking message since we're stopping
          setMessages(currentMessages => 
            currentMessages.filter(msg => msg.id !== thinkingMessage.id)
          );
          
          toast({
            title: "Save Failed",
            description: "Unable to save your conversation. Please try again or check your connection.",
            variant: "destructive",
          });
          
          // Exit early - don't continue with API call if we can't save
          return;
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
            if (process.env.NODE_ENV === 'development') console.log('🧠 Learning preferences updated from full conversation context');
          } catch (error) {
            console.warn('Failed to extract learning preferences:', error);
          }
        }
      }

      if (process.env.NODE_ENV === 'development') console.log('🌐 Starting API call...');
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

      if (process.env.NODE_ENV === 'development') console.log('📡 API response received, starting to read stream...');
      const decoder = new TextDecoder();
      let buffer = '';
      let hasReceivedFirstChunk = false;
      let accumulatedContent = '';

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
                if (process.env.NODE_ENV === 'development') console.log('🏁 Stream complete - setting isLoading to false');
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
                            if (process.env.NODE_ENV === 'development') console.log(`Final save with updated title: ${generatedTitle}`);
                          } else {
                            await chatServiceRef.current?.saveChatSession(currentMessages, settings.model);
                            if (process.env.NODE_ENV === 'development') console.log(`Final save: chat session with ${currentMessages.length} messages (title preserved)`);
                          }
                        } else {
                          // First message was already saved with title above
                          await chatServiceRef.current?.saveChatSession(currentMessages, settings.model);
                          if (process.env.NODE_ENV === 'development') console.log(`Final save: chat session with ${currentMessages.length} messages`);
                        }
                      } catch (error) {
                        console.error('❌ CRITICAL: Failed to save final chat session:', error);
                        // Show user that their conversation may not be saved
                        toast({
                          title: "Save Warning",
                          description: "Your conversation may not be fully saved. Please check your chat history.",
                          variant: "destructive",
                        });
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
                      if (!hasReceivedFirstChunk && lastMessage.metadata?.isThinking) {
                        // First chunk: calculate if we need to delay
                        const thinkingDuration = Date.now() - thinkingStartTime;
                        const minimumThinkingTime = 800; // Show thinking for at least 800ms
                        
                        if (thinkingDuration < minimumThinkingTime) {
                          // Delay replacing the thinking message
                          const remainingTime = minimumThinkingTime - thinkingDuration;
                          if (process.env.NODE_ENV === 'development') console.log(`🎯 Delaying thinking message replacement by ${remainingTime}ms`);
                          
                          // Store the content to accumulate
                          accumulatedContent = parsed.content;
                          
                          setTimeout(() => {
                            setMessages(prev => {
                              const updated = [...prev];
                              const lastIdx = updated.length - 1;
                              if (updated[lastIdx] && updated[lastIdx].role === 'assistant') {
                                updated[lastIdx] = {
                                  ...updated[lastIdx],
                                  content: accumulatedContent,
                                  metadata: {
                                    ...updated[lastIdx].metadata,
                                    isThinking: false,
                                  },
                                };
                              }
                              return updated;
                            });
                          }, remainingTime);
                          
                          hasReceivedFirstChunk = true;
                          return prev; // Don't update yet
                        } else {
                          // Enough time has passed, replace immediately
                          if (process.env.NODE_ENV === 'development') console.log('🎯 First chunk received - replacing thinking message');
                          hasReceivedFirstChunk = true;
                          updated[lastMessageIndex] = {
                            ...lastMessage,
                            content: parsed.content,
                            metadata: {
                              ...lastMessage.metadata,
                              isThinking: false,
                            },
                          };
                        }
                      } else {
                        // Subsequent chunks: append content
                        if (accumulatedContent) {
                          // We're accumulating content during the delay
                          accumulatedContent += parsed.content;
                        } else {
                          // Normal streaming after thinking is shown
                          updated[lastMessageIndex] = {
                            ...lastMessage,
                            content: lastMessage.content + parsed.content
                          };
                        }
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
    })(); // Close the async IIFE

    // Note: we don't setIsLoading(false) here because the streaming will handle that
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