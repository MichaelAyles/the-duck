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
  // Loading state for session operations
  isLoadingSession: boolean;
}

export function useChatSession({
  initialSessionId,
  initialMessages,
  userId,
  onSessionUpdate,
}: UseChatSessionProps): UseChatSessionReturn {
  // CRITICAL FIX: Use ref for stable session ID to prevent race conditions
  const sessionIdRef = useRef<string | null>(initialSessionId || null);
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId || null);
  const [messages, setMessages] = useState<Message[]>(initialMessages || []);
  const [detectedArtifacts, setDetectedArtifacts] = useState<ParsedArtifact[]>([]);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
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
      setIsLoadingSession(true);
      
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
    } finally {
      setIsLoadingSession(false);
    }
  }, [userId, welcomeMessage, toast]);

  // Create a new session with operation locking safety and immediate persistence
  const createNewSession = useCallback(async (title?: string): Promise<string> => {
    // CRITICAL FIX: Don't create new session if operation is in progress
    if (isOperationInProgress.current) {
      logger.dev.log('🚨 [RACE CONDITION PREVENTION] Blocked new session creation during operation');
      // Return the locked session ID to prevent race condition
      return lockedSessionId.current || sessionId || generatedSessionIdRef.current || 'temp-session';
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
  }, [userId]);  
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
  // CRITICAL FIX: Use ref to store generated session ID to prevent recreation
  const generatedSessionIdRef = useRef<string | null>(null);
  
  useEffect(() => {
    // Generate session ID once and reuse
    if (!generatedSessionIdRef.current && !initialSessionId) {
      generatedSessionIdRef.current = crypto.randomUUID();
    }
    
    const currentSessionId = initialSessionId || generatedSessionIdRef.current;
    
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
    if (currentSessionId !== sessionIdRef.current) {
      logger.dev.log(`🔄 Session ID changing from ${sessionIdRef.current} to ${currentSessionId}`);
      sessionIdRef.current = currentSessionId;
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
  }, [initialSessionId, userId]);  
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
  // CRITICAL FIX: Simplify welcome message logic to prevent race conditions
  useEffect(() => {
    if (messages.length === 0 && sessionId && !isLoadingSession && !lastLoadedSessionId.current) {
      // Only add welcome message if we're not currently loading and have no messages
      logger.dev.log('Adding welcome message to empty chat');
      setMessages([welcomeMessage]);
    }
  }, [sessionId, isLoadingSession, welcomeMessage]); // Remove messages.length dependency to prevent loops

  // CRITICAL FIX: Operation locking functions to prevent race conditions
  const lockSession = useCallback(() => {
    const currentSessionId = sessionIdRef.current; // Use ref for stable value
    logger.dev.log(`🔒 Locking session: ${currentSessionId}`);
    isOperationInProgress.current = true;
    lockedSessionId.current = currentSessionId;
  }, []);

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
    isLoadingSession,
  };
}