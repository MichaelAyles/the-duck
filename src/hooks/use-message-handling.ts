"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
import { ChatService } from '@/lib/chat-service';
import { Message } from '@/types/chat';
import { ChatSettings } from '@/components/chat/chat-types';
import { useToast } from '@/hooks/use-toast';
import { API_ENDPOINTS } from '@/lib/config';
import type { FileUpload } from '@/types/file-upload';
import { logger } from '@/lib/logger';
import { sessionCache } from '@/lib/local-session-cache';
import { useArtifacts } from '@/hooks/use-artifacts';

interface UseMessageHandlingProps {
  sessionId: string | null;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  settings: ChatSettings;
  chatServiceRef: React.MutableRefObject<ChatService | null>;
  userId?: string;
  onTitleGenerated?: (sessionId: string, title: string) => void;
  // CRITICAL FIX: Add session locking functions to prevent race conditions
  lockSession?: () => void;
  unlockSession?: () => void;
}

interface UseMessageHandlingReturn {
  isLoading: boolean;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  handleSendMessage: (content: string, attachments?: FileUpload[]) => void;
  generateTitleIfNeeded: (messages: Message[], sessionId: string) => Promise<string | null>;
}

export function useMessageHandling({
  sessionId,
  messages,
  setMessages,
  settings,
  chatServiceRef,
  userId,
  onTitleGenerated,
  lockSession,
  unlockSession,
}: UseMessageHandlingProps): UseMessageHandlingReturn {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const lastSummarizeTime = useRef<number>(0);
  const messagesRef = useRef<Message[]>(messages);
  const { processMessageForArtifacts } = useArtifacts({ userId, sessionId: sessionId || undefined });
  const isMounted = useRef<boolean>(true);
  const artifactTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Keep messages ref up to date
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Track mounted state and cleanup timeouts
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      // Clear any pending timeouts on unmount
      if (artifactTimeoutRef.current) {
        clearTimeout(artifactTimeoutRef.current);
        artifactTimeoutRef.current = null;
      }
    };
  }, []);

  // Generate title with new logic: try AI, fallback to existing title on failure
  const generateTitleIfNeeded = useCallback(async (messages: Message[], sessionId: string): Promise<string | null> => {
    // Filter out welcome message, system messages, and empty messages
    const conversationMessages = messages.filter(msg => 
      msg.id !== "welcome-message" && 
      msg.role !== "system" &&
      msg.metadata?.model !== "system" &&
      msg.content && 
      msg.content.trim().length > 0
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
            preserveExistingOnFailure: true
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (process.env.NODE_ENV === 'development') {
            logger.dev.log(`Generated/updated title for session ${sessionId}:`, data.title);
          }
          return data.title; // Return the new title
        } else {
          const errorText = await response.text();
          logger.error(`Failed to generate title for session ${sessionId}:`, response.status, response.statusText, errorText);
          return null; // Return null to indicate failure - existing title will be preserved
        }
      } catch (error) {
        logger.error('Error generating title:', error);
        return null; // Return null to indicate failure
      }
    }
    
    return null; // No title generated
  }, []);

  const handleSendMessage = useCallback((content: string, attachments?: FileUpload[]) => {
    const startTime = performance.now();
    if (process.env.NODE_ENV === 'development') {
      if (process.env.NODE_ENV === 'development') logger.dev.log(`🚀 [${new Date().toISOString()}] handleSendMessage called`);
    }
    if ((!content.trim() && (!attachments || attachments.length === 0)) || isLoading) return;

    // CRITICAL FIX: Lock session at the very beginning of message handling
    if (lockSession) {
      lockSession();
      if (process.env.NODE_ENV === 'development') {
        logger.dev.log(`🔒 [RACE CONDITION PREVENTION] Session locked for message handling`);
      }
    }

    if (process.env.NODE_ENV === 'development') {
      if (process.env.NODE_ENV === 'development') logger.dev.log(`🚀 [${new Date().toISOString()}] Creating user and thinking messages`);
    }
    
    // Format content with attachments info if present
    let messageContent = content.trim();
    if (!messageContent && attachments && attachments.length > 0) {
      messageContent = `[Attached ${attachments.length} file${attachments.length > 1 ? 's' : ''}]`;
    }
    
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: messageContent,
      timestamp: new Date(),
      attachments: attachments?.map(file => ({
        id: file.id,
        file_name: file.file_name,
        file_type: file.file_type,
        file_size: file.file_size,
        mime_type: file.mime_type, // Add mime_type for FilePreview component
        url: (file as FileUpload & { url?: string }).url,
      })),
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
      logger.dev.log('📋 Current messages before filtering:', currentMessages.map(m => ({ id: m.id, role: m.role, content: m.content.slice(0, 20) })));
      logger.dev.log('🚀 About to update UI with messages');
    }
    
    // IMMEDIATELY update UI - no awaits, no blocking
    const filteredMessages = currentMessages.filter(msg => msg.id !== "welcome-message");
    
    if (process.env.NODE_ENV === 'development') {
      logger.dev.log('📋 Filtered messages (no welcome):', filteredMessages.map(m => ({ id: m.id, role: m.role, content: m.content.slice(0, 20) })));
    }
    
    const newMessages = [...filteredMessages, userMessage, thinkingMessage];
    
    if (process.env.NODE_ENV === 'development') {
      logger.dev.log('📋 New messages array to set:', newMessages.map(m => ({ id: m.id, role: m.role, content: m.content.slice(0, 20), isThinking: m.metadata?.isThinking })));
    }
    
    // Update the ref immediately to ensure consistency
    messagesRef.current = newMessages;
    
    // Update state immediately without flushSync
    if (process.env.NODE_ENV === 'development') logger.dev.log(`⚡ [${new Date().toISOString()}] Updating messages and loading state`);
    setMessages(newMessages);
    setIsLoading(true);
    const updateTime = performance.now() - startTime;
    if (process.env.NODE_ENV === 'development') logger.dev.log(`[${new Date().toISOString()}] State updated - took ${updateTime.toFixed(2)}ms`);

    // Fire and forget: run all background operations asynchronously
    (async () => {

    try {
      // SKIP INITIAL SAVE - Only save once at the end to prevent race conditions
      // Save chat session if storage is enabled and user is authenticated
      if (settings.storageEnabled && userId && sessionId) {
        try {
          // Cache update only - actual save happens at the end
          sessionCache.update(sessionId, {
            title: 'New Chat',
            updatedAt: new Date().toISOString(),
            messageCount: newMessages.length - 1, // Exclude thinking message
            preview: userMessage.content.substring(0, 100),
            model: settings.model
          });
          
          // Link attachments to message and session if they exist
          if (attachments && attachments.length > 0) {
            try {
              await fetch('/api/files/link-message', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  file_ids: attachments.map(file => file.id),
                  message_id: userMessage.id,
                  session_id: sessionId,
                }),
              });
              if (process.env.NODE_ENV === 'development') logger.dev.log(`Linked ${attachments.length} attachments to message`);
            } catch (error) {
              logger.dev.log('Failed to link attachments to message:', error);
              // Don't fail the entire operation if linking fails
            }
          }
          
        } catch (error) {
          logger.error('❌ Failed to update cache:', error);
          // Continue with API call even if cache update fails
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
            if (process.env.NODE_ENV === 'development') logger.dev.log('🧠 Learning preferences updated from full conversation context');
          } catch (error) {
            logger.dev.log('Failed to extract learning preferences:', error);
          }
        }
      }

      if (process.env.NODE_ENV === 'development') logger.dev.log('🌐 Starting API call...');
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
                attachments: msg.attachments,
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
          memoryEnabled: settings.memoryEnabled,
          memorySummaryCount: settings.memorySummaryCount,
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

      if (process.env.NODE_ENV === 'development') logger.dev.log('📡 API response received, starting to read stream...');
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
                if (process.env.NODE_ENV === 'development') logger.dev.log('🏁 Stream complete - setting isLoading to false');
                setIsLoading(false);
                
                // CRITICAL FIX: Unlock session when streaming completes successfully
                if (unlockSession) {
                  unlockSession();
                  if (process.env.NODE_ENV === 'development') {
                    logger.dev.log(`🔓 [RACE CONDITION PREVENTION] Session unlocked after successful streaming`);
                  }
                }
                
                // Save final session and update title when response is complete
                if (sessionId && userId && settings.storageEnabled) {
                  setMessages(currentMessages => {
                    // Process artifacts in the completed assistant message
                    // Clear any existing timeout
                    if (artifactTimeoutRef.current) {
                      clearTimeout(artifactTimeoutRef.current);
                    }
                    
                    artifactTimeoutRef.current = setTimeout(async () => {
                      // Check if component is still mounted before updating state
                      if (!isMounted.current) {
                        return;
                      }
                      
                      // Process the last assistant message for artifacts
                      const lastMessage = currentMessages[currentMessages.length - 1];
                      if (lastMessage && lastMessage.role === 'assistant') {
                        try {
                          const processedMessage = await processMessageForArtifacts(lastMessage);
                          if (processedMessage !== lastMessage && isMounted.current) {
                            // Update the message with artifact information
                            setMessages(prev => {
                              const updated = [...prev];
                              updated[updated.length - 1] = processedMessage;
                              return updated;
                            });
                            if (process.env.NODE_ENV === 'development') {
                              logger.dev.log(`Processed artifacts for message: ${lastMessage.id}`);
                            }
                          }
                        } catch (error) {
                          logger.error('Failed to process artifacts:', error);
                        }
                      }
                      
                      // Clear the timeout ref after execution
                      artifactTimeoutRef.current = null;
                    }, 100);

                    // SINGLE SAVE STRATEGY: Save the complete conversation once at the end
                    setTimeout(async () => {
                      try {
                        const userMessages = currentMessages.filter(msg => msg.role === 'user');
                        
                        // Generate title for first message only
                        let titleToUse: string | undefined;
                        if (userMessages.length === 1) {
                          const generatedTitle = await generateTitleIfNeeded(currentMessages, sessionId);
                          titleToUse = generatedTitle || undefined;
                        }
                        
                        // Always save the complete conversation
                        await chatServiceRef.current?.saveChatSession(currentMessages, settings.model, titleToUse);
                        
                        // Notify about title if generated
                        if (titleToUse && onTitleGenerated) {
                          onTitleGenerated(sessionId, titleToUse);
                        }
                        
                        // Update cache with final conversation state
                        sessionCache.update(sessionId, {
                          title: titleToUse || 'Chat Session',
                          updatedAt: new Date().toISOString(),
                          messageCount: currentMessages.length,
                          preview: currentMessages[currentMessages.length - 1]?.content?.substring(0, 100) || '',
                          model: settings.model
                        });
                        
                        if (process.env.NODE_ENV === 'development') {
                          logger.dev.log(`✅ SINGLE SAVE: Successfully saved complete conversation with ${currentMessages.length} messages`);
                        }
                      } catch (error) {
                        logger.error('❌ CRITICAL: Failed to save final chat session:', error);
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
                
                // Session update notification removed - not needed since session ID doesn't change
                // The parent component already manages the session through the ChatContainer
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
                          if (process.env.NODE_ENV === 'development') logger.dev.log(`🎯 Delaying thinking message replacement by ${remainingTime}ms`);
                          
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
                          if (process.env.NODE_ENV === 'development') logger.dev.log('🎯 First chunk received - replacing thinking message');
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
                logger.dev.log('Failed to parse streaming data:', data, parseError);
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
      logger.error("Error sending message:", error);
      
      // CRITICAL FIX: Unlock session on error to prevent permanent lock
      if (unlockSession) {
        unlockSession();
        if (process.env.NODE_ENV === 'development') {
          logger.dev.log(`🔓 [RACE CONDITION PREVENTION] Session unlocked after error`);
        }
      }
      
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
    onTitleGenerated,
    setMessages,
    toast,
    lockSession,
    unlockSession,
    processMessageForArtifacts,
  ]);

  return {
    isLoading,
    setIsLoading,
    handleSendMessage,
    generateTitleIfNeeded,
  };
}