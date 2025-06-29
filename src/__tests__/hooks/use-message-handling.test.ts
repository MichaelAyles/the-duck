import { renderHook, act } from '@testing-library/react';
import { useMessageHandling } from '@/hooks/use-message-handling';
import { Message } from '@/types/chat';
import { useToast } from '@/hooks/use-toast';
import { FileUpload } from '@/types/file-upload';
import { ChatService } from '@/lib/chat-service';

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
jest.mock('@/hooks/use-artifacts', () => ({
  useArtifacts: () => ({ 
    processMessageForArtifacts: jest.fn((msg) => msg) 
  })
}));

// Mock fetch
global.fetch = jest.fn();

describe('useMessageHandling', () => {
  const mockChatService = {
    sessionId: 'test-session-id',
    saveChatSession: jest.fn(),
    setInactivityHandler: jest.fn(),
    clearInactivityTimer: jest.fn(),
    setupInactivityHandler: jest.fn(),
    getSessionId: jest.fn().mockReturnValue('test-session-id'),
    loadChatSession: jest.fn(),
    setUserId: jest.fn(),
    parseSessionMessages: jest.fn(),
    summarizeChat: jest.fn(),
    getCurrentSessionTitle: jest.fn(),
    generateChatTitle: jest.fn(),
    appendMessageToSession: jest.fn(),
    endChat: jest.fn(),
    deleteChat: jest.fn(),
  } as unknown as ChatService;

  const defaultProps = {
    sessionId: 'test-session-id',
    messages: [] as Message[],
    setMessages: jest.fn(),
    settings: {
      model: 'test-model',
      tone: 'friendly',
      storageEnabled: true,
      memoryEnabled: false,
      memorySummaryCount: 5,
    },
    chatServiceRef: { current: mockChatService },
    userId: 'test-user',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: jest.fn()
            .mockResolvedValueOnce({ 
              done: false, 
              value: new TextEncoder().encode('data: {"content": "Hello"}\n\n') 
            })
            .mockResolvedValueOnce({ 
              done: false, 
              value: new TextEncoder().encode('data: [DONE]\n\n') 
            })
            .mockResolvedValueOnce({ done: true }),
        }),
      },
    });
  });

  it('should initialize with loading state false', () => {
    const { result } = renderHook(() => useMessageHandling(defaultProps));

    expect(result.current.isLoading).toBe(false);
  });

  it('should handle sending a message', async () => {
    const setMessages = jest.fn();
    const props = { ...defaultProps, setMessages };
    
    const { result } = renderHook(() => useMessageHandling(props));

    await act(async () => {
      result.current.handleSendMessage('Hello AI!');
    });

    // Should add user message
    expect(setMessages).toHaveBeenCalledWith(expect.any(Function));
    
    // Should call API
    expect(global.fetch).toHaveBeenCalledWith('/api/chat', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: expect.stringContaining('Hello AI!'),
    }));
  });

  it('should handle empty message', async () => {
    const { result } = renderHook(() => useMessageHandling(defaultProps));

    await act(async () => {
      result.current.handleSendMessage('   '); // Empty/whitespace message
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });

  it('should handle API errors gracefully', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'API Error' }),
    });

    const { result } = renderHook(() => useMessageHandling(defaultProps));
    const mockToast = (useToast as jest.Mock)().toast;

    await act(async () => {
      result.current.handleSendMessage('Test message');
    });

    expect(mockToast).toHaveBeenCalledWith({
      title: "Error",
      description: expect.stringContaining('API Error'),
      variant: "destructive",
    });
    expect(result.current.isLoading).toBe(false);
  });

  it('should handle streaming response', async () => {
    const setMessages = jest.fn();
    const props = { ...defaultProps, setMessages };
    
    const { result } = renderHook(() => useMessageHandling(props));

    await act(async () => {
      result.current.handleSendMessage('Hello');
    });

    // Wait for streaming to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Should update messages with streamed content
    expect(setMessages).toHaveBeenCalledTimes(4); // User msg, assistant placeholder, content update, final update
    expect(result.current.isLoading).toBe(false);
  });

  it('should save session after successful response', async () => {
    const props = {
      ...defaultProps,
      settings: { ...defaultProps.settings, storageEnabled: true },
    };
    
    const { result } = renderHook(() => useMessageHandling(props));

    await act(async () => {
      result.current.handleSendMessage('Test');
    });

    // Wait for streaming and save
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
    });

    expect(mockChatService.saveChatSession).toHaveBeenCalled();
  });

  it('should not save session if storage is disabled', async () => {
    const props = {
      ...defaultProps,
      settings: { ...defaultProps.settings, storageEnabled: false },
    };
    
    const { result } = renderHook(() => useMessageHandling(props));

    await act(async () => {
      result.current.handleSendMessage('Test');
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
    });

    expect(mockChatService.saveChatSession).not.toHaveBeenCalled();
  });

  it('should handle file attachments', async () => {
    const attachments: FileUpload[] = [{
      id: 'file-1',
      file_name: 'test.jpg',
      file_type: 'image',
      file_size: 1000,
      mime_type: 'image/jpeg',
      storage_path: '/path/to/file',
      user_id: 'test-user',
      session_id: 'test-session',
      created_at: new Date().toISOString(),
    }];

    const { result } = renderHook(() => useMessageHandling(defaultProps));

    await act(async () => {
      result.current.handleSendMessage('Check this image', attachments);
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/chat', expect.objectContaining({
      body: expect.stringContaining('"attachments"'),
    }));
  });

  it('should generate title for new conversation', async () => {
    const onTitleGenerated = jest.fn();
    const messages = [
      { id: '1', role: 'user' as const, content: 'Hello', timestamp: new Date() },
      { id: '2', role: 'assistant' as const, content: 'Hi there!', timestamp: new Date() },
    ];
    
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ title: 'New Chat Title' }),
    });

    const { result } = renderHook(() => 
      useMessageHandling({ ...defaultProps, onTitleGenerated })
    );

    await act(async () => {
      await result.current.generateTitleIfNeeded(messages, 'session-id');
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/generate-title', expect.any(Object));
    expect(onTitleGenerated).toHaveBeenCalledWith('session-id', 'New Chat Title');
  });

  it('should handle title generation failure', async () => {
    const messages = [
      { id: '1', role: 'user' as const, content: 'Hello', timestamp: new Date() },
    ];
    
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useMessageHandling(defaultProps));

    let title;
    await act(async () => {
      title = await result.current.generateTitleIfNeeded(messages, 'session-id');
    });

    expect(title).toBe(null);
  });

  it('should lock/unlock session when provided', async () => {
    const lockSession = jest.fn();
    const unlockSession = jest.fn();
    const props = { ...defaultProps, lockSession, unlockSession };
    
    const { result } = renderHook(() => useMessageHandling(props));

    await act(async () => {
      result.current.handleSendMessage('Test');
    });

    expect(lockSession).toHaveBeenCalled();
    
    // Wait for completion
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
    });

    expect(unlockSession).toHaveBeenCalled();
  });

  it('should set loading state during message handling', async () => {
    const { result } = renderHook(() => useMessageHandling(defaultProps));

    const sendPromise = act(async () => {
      result.current.handleSendMessage('Test');
    });

    expect(result.current.isLoading).toBe(true);

    await sendPromise;
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
    });

    expect(result.current.isLoading).toBe(false);
  });
});