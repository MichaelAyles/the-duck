"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ChatService } from '@/lib/chat-service';
import { Message } from '@/types/chat';
import { CHAT_CONFIG, DEFAULT_AI_MODEL } from '@/lib/config';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { ArtifactParser } from '@/lib/artifact-parser';
import { ParsedArtifact } from '@/types/artifact';

interface UseChatSessionProps {
  initialSessionId?: string | null;
  initialMessages?: Message[];
  userId?: string;
  onSessionUpdate?: (sessionId: string, newMessages: Message[]) => void;
}

interface UseChatSessionReturn {
  sessionId: string | null;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  chatServiceRef: React.MutableRefObject<ChatService | null>;
  loadSessionMessages: (sessionId: string) => Promise<void>;
  createNewSession: (title?: string) => Promise<string>;
  // CRITICAL FIX: Add operation locking functions to prevent race conditions
  lockSession: () => void;
  unlockSession: () => void;
  // DuckPond artifact tracking
  detectedArtifacts: ParsedArtifact[];
}

export function useChatSession({
  initialSessionId,
  initialMessages,
  userId,
  onSessionUpdate,
}: UseChatSessionProps): UseChatSessionReturn {
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId || null);
  const [messages, setMessages] = useState<Message[]>(initialMessages || []);
  const [detectedArtifacts, setDetectedArtifacts] = useState<ParsedArtifact[]>([]);
  const chatServiceRef = useRef<ChatService | null>(null);
  const lastLoadedSessionId = useRef<string | null>(null);
  const { toast } = useToast();
  
  // CRITICAL FIX: Add operation locking to prevent session changes during critical operations
  const isOperationInProgress = useRef<boolean>(false);
  const lockedSessionId = useRef<string | null>(null);
  
  // Acknowledge the parameter to avoid unused variable warning
  void onSessionUpdate;

  // Create stable welcome message to prevent unnecessary re-renders
  const welcomeMessage = useMemo((): Message => ({
    id: "welcome-message", // Use stable ID instead of random UUID
    role: "assistant",
    content: CHAT_CONFIG.WELCOME_MESSAGE,
    timestamp: new Date(0), // Use epoch timestamp for stability
    metadata: {
      model: "system",
    },
  }), []);

  // Load messages for an existing session with race condition protection
  const loadSessionMessages = useCallback(async (sessionId: string) => {
    try {
      if (!userId || !chatServiceRef.current) {
        logger.dev.log('Skipping session load: missing userId or chatService');
        return;
      }
      
      // Prevent duplicate loads of the same session
      if (lastLoadedSessionId.current === sessionId) {
        logger.dev.log(`Session ${sessionId} already loaded, skipping duplicate request`);
        return;
      }
      
      // Prevent overlapping load requests using the ref instead of state
      if (lastLoadedSessionId.current === `loading-${sessionId}`) {
        logger.dev.log(`Session load already in progress, skipping request for ${sessionId}`);
        return;
      }
      
      logger.dev.log(`🔄 Loading session messages for: ${sessionId}`);
      lastLoadedSessionId.current = `loading-${sessionId}`;
      
      // Load messages using ChatService (now with retry logic)
      const loadedMessages = await chatServiceRef.current.loadChatSession();
      
      if (loadedMessages && loadedMessages.length > 0) {
        // Convert loaded messages to proper format with dates
        const formattedMessages = loadedMessages.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
        
        // Scan messages for DuckPond artifacts
        const allArtifacts: ParsedArtifact[] = [];
        for (const message of formattedMessages) {
          if (message.role === 'assistant' && message.content) {
            try {
              const parseResult = ArtifactParser.parseContent(message.content);
              if (parseResult.hasArtifacts) {
                allArtifacts.push(...parseResult.artifacts);
              }
            } catch (error) {
              logger.error('Error parsing artifacts from message:', error);
            }
          }
        }
        
        if (allArtifacts.length > 0) {
          logger.dev.log(`🦆 Found ${allArtifacts.length} DuckPond artifact(s) in loaded session`);
          setDetectedArtifacts(allArtifacts);
        } else {
          setDetectedArtifacts([]);
        }
        
        setMessages(formattedMessages);
        logger.dev.log(`Loaded ${formattedMessages.length} messages for session ${sessionId}`);
        lastLoadedSessionId.current = sessionId;
      } else {
        // If no messages found, show welcome message
        setMessages([welcomeMessage]);
        setDetectedArtifacts([]);
        logger.dev.log('📝 No messages found, showing welcome message');
        lastLoadedSessionId.current = sessionId;
      }
    } catch (error) {
      logger.error('Error loading session messages:', error);
      
      // Reset the loaded session tracking on error to allow retries
      lastLoadedSessionId.current = null;
      
      // Show user-friendly error toast
      toast({
        title: "Session Load Failed",
        description: "Unable to load previous messages. Starting with a fresh conversation.",
        variant: "destructive",
      });
      
      // On error, show welcome message and clear artifacts
      setMessages([welcomeMessage]);
      setDetectedArtifacts([]);
    }
  }, [userId, welcomeMessage, toast]);

  // Create a new session with operation locking safety and immediate persistence
  const createNewSession = useCallback(async (title?: string): Promise<string> => {
    // CRITICAL FIX: Don't create new session if operation is in progress
    if (isOperationInProgress.current) {
      logger.dev.log('🚨 [RACE CONDITION PREVENTION] Blocked new session creation during operation');
      // Return the locked session ID to prevent race condition
      return lockedSessionId.current || sessionId || crypto.randomUUID();
    }
    
    const newSessionId = crypto.randomUUID();
    logger.dev.log(`🆕 Creating new session: ${newSessionId} (previous: ${sessionId})`);
    
    setSessionId(newSessionId);
    chatServiceRef.current = new ChatService(newSessionId, userId);
    
    // Clear artifacts for new session
    setDetectedArtifacts([]);
    
    // CRITICAL FIX: Immediately save empty session to database so it appears in sidebar
    if (userId) {
      try {
        await chatServiceRef.current.saveChatSession([], DEFAULT_AI_MODEL, title || 'New Chat');
        logger.dev.log(`✅ Empty session ${newSessionId} saved to database for sidebar display`);
      } catch (error) {
        logger.error(`❌ Failed to save new empty session ${newSessionId}:`, error);
        // Continue anyway - the session will be saved when first message is sent
      }
    }
    
    // Reset loading state for fresh session
    lastLoadedSessionId.current = null;
    return newSessionId;
  }, [userId, sessionId]);  
  // sessionId intentionally omitted to prevent unnecessary recreations

  // When initialMessages changes, update our state and scan for artifacts
  useEffect(() => {
    if (initialMessages && initialMessages.length > 0) {
      setMessages(initialMessages);
      
      // Scan initial messages for artifacts
      const allArtifacts: ParsedArtifact[] = [];
      for (const message of initialMessages) {
        if (message.role === 'assistant' && message.content) {
          try {
            const parseResult = ArtifactParser.parseContent(message.content);
            if (parseResult.hasArtifacts) {
              allArtifacts.push(...parseResult.artifacts);
            }
          } catch (error) {
            logger.error('Error parsing artifacts from initial messages:', error);
          }
        }
      }
      
      if (allArtifacts.length > 0) {
        logger.dev.log(`🦆 Found ${allArtifacts.length} DuckPond artifact(s) in initial messages`);
        setDetectedArtifacts(allArtifacts);
      } else {
        setDetectedArtifacts([]);
      }
      
      // Don't need to load from server if we already have messages
      if (initialSessionId) {
        lastLoadedSessionId.current = initialSessionId;
      }
    }
  }, [initialMessages, initialSessionId]);

  // Main session initialization and management effect with operation locking
  // CRITICAL FIX: Use lazy initialization to prevent race conditions
  const generatedSessionIdRef = useRef<string | null>(null);
  
  // Lazy initialization function to ensure UUID is generated only once
  const getOrGenerateSessionId = useCallback(() => {
    if (!generatedSessionIdRef.current && !initialSessionId) {
      generatedSessionIdRef.current = crypto.randomUUID();
    }
    return initialSessionId || generatedSessionIdRef.current;
  }, [initialSessionId]);
  
  useEffect(() => {
    const currentSessionId = getOrGenerateSessionId();
    
    // Ensure we have a valid session ID before proceeding
    if (!currentSessionId) {
      return; // Skip if no session ID available yet
    }
    
    // CRITICAL FIX: Don't change session ID if operation is in progress
    if (isOperationInProgress.current && lockedSessionId.current) {
      logger.dev.log(`🔒 [RACE CONDITION PREVENTION] Session locked during operation: ${lockedSessionId.current}`);
      return; // Prevent session changes during critical operations
    }
    
    // Only update session ID if it actually changed
    if (currentSessionId !== sessionId) {
      logger.dev.log(`🔄 Session ID changing from ${sessionId} to ${currentSessionId}`);
      setSessionId(currentSessionId);
      // Reset loading state when session changes
      lastLoadedSessionId.current = null;
    }
    
    // Always ensure we have a chat service
    if (!chatServiceRef.current || chatServiceRef.current.getSessionId() !== currentSessionId) {
      chatServiceRef.current = new ChatService(currentSessionId, userId);
      logger.dev.log(`🔧 Created ChatService for session ${currentSessionId}`);
    }

    return () => {
      chatServiceRef.current?.clearInactivityTimer();
    };
  }, [initialSessionId, userId]); // eslint-disable-line react-hooks/exhaustive-deps
  // CRITICAL FIX: sessionId intentionally omitted to prevent infinite loop
  
  // Separate effect for loading messages to prevent infinite loops
  // CRITICAL FIX: Remove loadSessionMessages from dependency array to prevent circular calls
  useEffect(() => {
    // Load messages if we have a user and existing session (but no initial messages provided)
    if (userId && initialSessionId && (!initialMessages || initialMessages.length === 0)) {
      // Only load if we haven't already loaded this session
      if (lastLoadedSessionId.current !== initialSessionId && lastLoadedSessionId.current !== `loading-${initialSessionId}`) {
        logger.dev.log(`Loading messages for existing session ${initialSessionId}`);
        loadSessionMessages(initialSessionId);
      }
    } else if (!initialSessionId || !userId) {
      // New session or no user - clear messages and artifacts to trigger welcome message
      setMessages([]);
      setDetectedArtifacts([]);
    }
  }, [userId, initialSessionId, initialMessages]); // eslint-disable-line react-hooks/exhaustive-deps
  // Note: loadSessionMessages intentionally omitted to prevent circular dependency

  // Add welcome message when messages are empty and not loading
  // CRITICAL FIX: Use refs to prevent race conditions
  const welcomeMessageTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasWelcomeMessageRef = useRef<boolean>(false);
  
  // Add welcome message when needed with race condition protection
  useEffect(() => {
    // Clear any existing timer
    if (welcomeMessageTimerRef.current) {
      clearTimeout(welcomeMessageTimerRef.current);
      welcomeMessageTimerRef.current = null;
    }
    
    // Check if we should add welcome message
    const shouldAddWelcome = messages.length === 0 && 
                           sessionId && 
                           !lastLoadedSessionId.current &&
                           !hasWelcomeMessageRef.current &&
                           !isOperationInProgress.current;
    
    if (shouldAddWelcome) {
      // Use a shorter delay to reduce race condition window
      welcomeMessageTimerRef.current = setTimeout(() => {
        setMessages(current => {
          // Double-check conditions inside setState to prevent race conditions
          if (current.length === 0 && 
              !current.some(msg => msg.id === 'welcome-message') &&
              !isOperationInProgress.current &&
              sessionId === lockedSessionId.current || !lockedSessionId.current) {
            logger.dev.log('Adding welcome message to empty chat');
            hasWelcomeMessageRef.current = true;
            return [welcomeMessage];
          }
          return current;
        });
      }, 50); // Reduced delay from 100ms to 50ms
    } else if (messages.length > 0) {
      // Reset flag when messages are present
      hasWelcomeMessageRef.current = false;
    }
    
    // Cleanup function
    return () => {
      if (welcomeMessageTimerRef.current) {
        clearTimeout(welcomeMessageTimerRef.current);
        welcomeMessageTimerRef.current = null;
      }
    };
  }, [messages.length, sessionId, welcomeMessage]);  
  // isOperationInProgress and lockedSessionId intentionally read from refs

  // CRITICAL FIX: Operation locking functions to prevent race conditions
  const lockSession = useCallback(() => {
    const currentSessionId = sessionId; // Capture current session ID
    logger.dev.log(`🔒 Locking session: ${currentSessionId}`);
    isOperationInProgress.current = true;
    lockedSessionId.current = currentSessionId;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // sessionId intentionally captured in closure to prevent unnecessary recreations

  const unlockSession = useCallback(() => {
    logger.dev.log(`🔓 Unlocking session: ${lockedSessionId.current}`);
    isOperationInProgress.current = false;
    lockedSessionId.current = null;
  }, []);

  return {
    sessionId,
    messages,
    setMessages,
    chatServiceRef,
    loadSessionMessages,
    createNewSession,
    lockSession,
    unlockSession,
    detectedArtifacts,
  };
}