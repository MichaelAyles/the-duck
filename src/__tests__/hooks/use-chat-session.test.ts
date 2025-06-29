import { renderHook, act } from '@testing-library/react';
import { useChatSession } from '@/hooks/use-chat-session';
import { ChatService } from '@/lib/chat-service';
import { logger } from '@/lib/logger';

// Mock dependencies
jest.mock('@/lib/chat-service');
jest.mock('@/lib/logger', () => ({
  logger: {
    dev: { log: jest.fn() },
    error: jest.fn(),
    warn: jest.fn(),
  }
}));
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() })
}));

describe('useChatSession', () => {
  const mockChatService = {
    getSessionId: jest.fn(),
    loadChatSession: jest.fn(),
    setUserId: jest.fn(),
    clearInactivityTimer: jest.fn(),
    setupInactivityHandler: jest.fn(),
    saveChatSession: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (ChatService as jest.Mock).mockImplementation(() => mockChatService);
    mockChatService.getSessionId.mockReturnValue('test-session-id');
    mockChatService.loadChatSession.mockResolvedValue([]);
  });

  it('should initialize with session ID and empty messages', async () => {
    const { result } = renderHook(() => 
      useChatSession({
        initialSessionId: 'test-session-id',
        userId: 'test-user',
      })
    );

    expect(result.current.sessionId).toBe('test-session-id');
    
    // Welcome message is added after a delay
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });
    
    expect(result.current.messages).toHaveLength(1); // Welcome message
    expect(result.current.messages[0].id).toBe('welcome-message');
  });

  it('should generate session ID if not provided', () => {
    const { result } = renderHook(() => 
      useChatSession({
        userId: 'test-user',
      })
    );

    expect(result.current.sessionId).toBeTruthy();
    expect(result.current.sessionId).not.toBe('');
  });

  it('should initialize with provided messages', async () => {
    const initialMessages = [
      {
        id: 'msg-1',
        role: 'user' as const,
        content: 'Hello',
        timestamp: new Date(),
      },
      {
        id: 'msg-2',
        role: 'assistant' as const,
        content: 'Hi there!',
        timestamp: new Date(),
      },
    ];

    const { result } = renderHook(() => 
      useChatSession({
        initialSessionId: 'test-session-id',
        initialMessages,
        userId: 'test-user',
      })
    );

    // Wait for the useEffect to run and update messages
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Initial messages are used directly without welcome message
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].content).toBe('Hello');
    expect(result.current.messages[1].content).toBe('Hi there!');
  });

  it('should load session messages', async () => {
    const loadedMessages = [
      {
        id: 'loaded-1',
        role: 'user' as const,
        content: 'Loaded message',
        timestamp: new Date(),
      },
    ];
    mockChatService.loadChatSession.mockResolvedValue(loadedMessages);

    const { result } = renderHook(() => 
      useChatSession({
        initialSessionId: 'test-session-id',
        userId: 'test-user',
      })
    );

    await act(async () => {
      await result.current.loadSessionMessages('test-session-id');
    });

    expect(mockChatService.loadChatSession).toHaveBeenCalled();
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].content).toBe('Loaded message');
  });

  it('should create new session', async () => {
    const newSessionId = 'new-session-id';
    mockChatService.getSessionId.mockReturnValue(newSessionId);

    const { result } = renderHook(() => 
      useChatSession({
        userId: 'test-user',
      })
    );

    await act(async () => {
      const newSessionId = await result.current.createNewSession('New Chat');
      expect(newSessionId).toBe('12345678-1234-1234-1234-123456789012');
    });

    expect(ChatService).toHaveBeenCalled();
    // createNewSession uses crypto.randomUUID(), not ChatService.getSessionId()
    expect(result.current.sessionId).toBe('12345678-1234-1234-1234-123456789012');
    
    // Wait for welcome message
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });
    
    expect(result.current.messages).toHaveLength(1); // Welcome message
  });

  it('should handle session locking and unlocking', () => {
    const { result } = renderHook(() => 
      useChatSession({
        userId: 'test-user',
      })
    );

    act(() => {
      result.current.lockSession();
    });

    // Check that locking was called
    expect(logger.dev.log).toHaveBeenCalledWith(
      expect.stringContaining('🔒 Locking session:')
    );

    act(() => {
      result.current.unlockSession();
    });

    expect(logger.dev.log).toHaveBeenCalledWith(
      expect.stringContaining('🔓 Unlocking session:')
    );
  });

  it('should update messages', () => {
    const { result } = renderHook(() => 
      useChatSession({
        userId: 'test-user',
      })
    );

    const newMessage = {
      id: 'new-msg',
      role: 'user' as const,
      content: 'New message',
      timestamp: new Date(),
    };

    act(() => {
      result.current.setMessages(prev => [...prev, newMessage]);
    });

    // Messages were directly set without waiting for welcome message
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].content).toBe('New message');
  });

  it('should handle errors when loading session fails', async () => {
    mockChatService.loadChatSession.mockRejectedValue(new Error('Load failed'));

    const { result } = renderHook(() => 
      useChatSession({
        initialSessionId: 'test-session-id',
        userId: 'test-user',
      })
    );

    await act(async () => {
      await result.current.loadSessionMessages('test-session-id');
    });

    expect(logger.error).toHaveBeenCalledWith(
      'Error loading session messages:',
      expect.any(Error)
    );
  });

  it('should skip loading if no user ID', async () => {
    const { result } = renderHook(() => 
      useChatSession({
        initialSessionId: 'test-session-id',
      })
    );

    await act(async () => {
      await result.current.loadSessionMessages('test-session-id');
    });

    expect(mockChatService.loadChatSession).not.toHaveBeenCalled();
  });

  it('should have stable chat service reference', () => {
    const { result, rerender } = renderHook(() => 
      useChatSession({
        userId: 'test-user',
      })
    );

    const firstRef = result.current.chatServiceRef;

    rerender();

    expect(result.current.chatServiceRef).toBe(firstRef);
  });
});