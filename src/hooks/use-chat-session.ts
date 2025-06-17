"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ChatService } from '@/lib/chat-service';
import { Message } from '@/types/chat';
import { CHAT_CONFIG } from '@/lib/config';
import { useToast } from '@/hooks/use-toast';

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
  createNewSession: () => string;
}

export function useChatSession({
  initialSessionId,
  initialMessages,
  userId,
  onSessionUpdate,
}: UseChatSessionProps): UseChatSessionReturn {
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId || null);
  const [messages, setMessages] = useState<Message[]>(initialMessages || []);
  const chatServiceRef = useRef<ChatService | null>(null);
  const lastLoadedSessionId = useRef<string | null>(null);
  const { toast } = useToast();
  
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
        if (process.env.NODE_ENV === 'development') {
          console.log('Skipping session load: missing userId or chatService');
        }
        return;
      }
      
      // Prevent duplicate loads of the same session
      if (lastLoadedSessionId.current === sessionId) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`Session ${sessionId} already loaded, skipping duplicate request`);
        }
        return;
      }
      
      // Prevent overlapping load requests using the ref instead of state
      if (lastLoadedSessionId.current === `loading-${sessionId}`) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`Session load already in progress, skipping request for ${sessionId}`);
        }
        return;
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔄 Loading session messages for: ${sessionId}`);
      }
      lastLoadedSessionId.current = `loading-${sessionId}`;
      
      // Load messages using ChatService (now with retry logic)
      const loadedMessages = await chatServiceRef.current.loadChatSession();
      
      if (loadedMessages && loadedMessages.length > 0) {
        // Convert loaded messages to proper format with dates
        const formattedMessages = loadedMessages.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
        
        setMessages(formattedMessages);
        if (process.env.NODE_ENV === 'development') {
          console.log(`Loaded ${formattedMessages.length} messages for session ${sessionId}`);
        }
        lastLoadedSessionId.current = sessionId;
      } else {
        // If no messages found, show welcome message
        setMessages([welcomeMessage]);
        if (process.env.NODE_ENV === 'development') {
          console.log('📝 No messages found, showing welcome message');
        }
        lastLoadedSessionId.current = sessionId;
      }
    } catch (error) {
      console.error('Error loading session messages:', error);
      
      // Reset the loaded session tracking on error to allow retries
      lastLoadedSessionId.current = null;
      
      // Show user-friendly error toast
      toast({
        title: "Session Load Failed",
        description: "Unable to load previous messages. Starting with a fresh conversation.",
        variant: "destructive",
      });
      
      // On error, show welcome message
      setMessages([welcomeMessage]);
    }
  }, [userId, welcomeMessage, toast]);

  // Create a new session
  const createNewSession = useCallback((): string => {
    const newSessionId = crypto.randomUUID();
    setSessionId(newSessionId);
    chatServiceRef.current = new ChatService(newSessionId, userId);
    // Reset loading state for fresh session
    lastLoadedSessionId.current = null;
    return newSessionId;
  }, [userId]);

  // When initialMessages changes, update our state
  useEffect(() => {
    if (initialMessages && initialMessages.length > 0) {
      setMessages(initialMessages);
      // Don't need to load from server if we already have messages
      if (initialSessionId) {
        lastLoadedSessionId.current = initialSessionId;
      }
    }
  }, [initialMessages, initialSessionId]);

  // Main session initialization and management effect
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
    
    // Only update session ID if it actually changed
    if (currentSessionId !== sessionId) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`Session ID changing from ${sessionId} to ${currentSessionId}`);
      }
      setSessionId(currentSessionId);
      // Reset loading state when session changes
      lastLoadedSessionId.current = null;
    }
    
    // Always ensure we have a chat service
    if (!chatServiceRef.current || chatServiceRef.current.getSessionId() !== currentSessionId) {
      chatServiceRef.current = new ChatService(currentSessionId, userId);
      if (process.env.NODE_ENV === 'development') {
        console.log(`Created ChatService for session ${currentSessionId}`);
      }
    }

    return () => {
      chatServiceRef.current?.clearInactivityTimer();
    };
  }, [initialSessionId, userId, sessionId]);
  
  // Separate effect for loading messages to prevent infinite loops
  // CRITICAL FIX: Remove loadSessionMessages from dependency array to prevent circular calls
  useEffect(() => {
    // Load messages if we have a user and existing session (but no initial messages provided)
    if (userId && initialSessionId && (!initialMessages || initialMessages.length === 0)) {
      // Only load if we haven't already loaded this session
      if (lastLoadedSessionId.current !== initialSessionId && lastLoadedSessionId.current !== `loading-${initialSessionId}`) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`Loading messages for existing session ${initialSessionId}`);
        }
        loadSessionMessages(initialSessionId);
      }
    } else if (!initialSessionId || !userId) {
      // New session or no user - clear messages to trigger welcome message
      setMessages([]);
    }
  }, [userId, initialSessionId, initialMessages]); // eslint-disable-line react-hooks/exhaustive-deps
  // Note: loadSessionMessages intentionally omitted to prevent circular dependency

  // Add welcome message when messages are empty and not loading
  // CRITICAL FIX: Use separate boolean state to prevent competing updates
  const [shouldShowWelcome, setShouldShowWelcome] = useState(false);
  
  // Check if we should show welcome message
  useEffect(() => {
    if (messages.length === 0 && sessionId && !lastLoadedSessionId.current) {
      setShouldShowWelcome(true);
    } else {
      setShouldShowWelcome(false);
    }
  }, [messages.length, sessionId]);
  
  // Add welcome message when needed
  useEffect(() => {
    if (shouldShowWelcome) {
      const timer = setTimeout(() => {
        setMessages(current => {
          // Only add if still empty and no welcome message exists
          if (current.length === 0 && !current.some(msg => msg.id === 'welcome-message')) {
            if (process.env.NODE_ENV === 'development') {
              console.log('Adding welcome message to empty chat');
            }
            return [welcomeMessage];
          }
          return current;
        });
        setShouldShowWelcome(false); // Reset flag after adding
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [shouldShowWelcome, welcomeMessage]);

  return {
    sessionId,
    messages,
    setMessages,
    chatServiceRef,
    loadSessionMessages,
    createNewSession,
  };
}