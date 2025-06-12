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

  // Load messages for an existing session
  const loadSessionMessages = useCallback(async () => {
    try {
      if (!userId || !chatServiceRef.current) return;
      
      
      // Load messages using ChatService
      const loadedMessages = await chatServiceRef.current.loadChatSession();
      
      if (loadedMessages && loadedMessages.length > 0) {
        // Convert loaded messages to proper format with dates
        const formattedMessages = loadedMessages.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
        
        setMessages(formattedMessages);
      } else {
        // If no messages found, show welcome message
        setMessages([welcomeMessage]);
      }
    } catch (error) {
      console.error('Error loading session messages:', error);
      
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
    return newSessionId;
  }, [userId]);

  // Handle session changes - this effect runs when the sessionId prop changes
  useEffect(() => {
    if (initialSessionId && initialSessionId !== sessionId) {
      // Session changed, update our state and load new messages
      setSessionId(initialSessionId);
      
      // Create new ChatService for the new session
      if (userId) {
        chatServiceRef.current = new ChatService(initialSessionId, userId);
        loadSessionMessages();
      }
    }
  }, [initialSessionId, sessionId, userId, loadSessionMessages]);

  // When initialMessages changes, update our state
  useEffect(() => {
    if (initialMessages) {
      setMessages(initialMessages);
    }
  }, [initialMessages]);

  // Initialize session and chat service
  useEffect(() => {
    const currentSessionId = initialSessionId || crypto.randomUUID();
    setSessionId(currentSessionId);
    
    chatServiceRef.current = new ChatService(currentSessionId, userId);

    // Load messages for the session
    if (userId) {
      if (initialSessionId && !initialMessages?.length) {
        // Load existing session messages if not already provided
        loadSessionMessages();
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
  }, [initialSessionId, userId, loadSessionMessages, initialMessages?.length]);

  // Add welcome message when messages are empty
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([welcomeMessage]);
    }
  }, [messages.length, welcomeMessage]);

  return {
    sessionId,
    messages,
    setMessages,
    chatServiceRef,
    loadSessionMessages,
    createNewSession,
  };
}