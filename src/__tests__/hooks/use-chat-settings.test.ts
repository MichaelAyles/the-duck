import { renderHook, act, waitFor } from '@testing-library/react';
import { useChatSettings } from '@/hooks/use-chat-settings';
import { DEFAULT_CHAT_SETTINGS } from '@/lib/config';
import { preferencesCache } from '@/lib/local-preferences-cache';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';

// Mock dependencies
jest.mock('@/hooks/use-starred-models', () => ({
  useStarredModels: () => ({
    activeModel: 'test-model',
    loading: false,
  })
}));
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() })
}));
jest.mock('@/lib/local-preferences-cache', () => ({
  preferencesCache: {
    get: jest.fn(),
    update: jest.fn(),
  }
}));
jest.mock('@/lib/logger', () => ({
  logger: {
    dev: { log: jest.fn() },
    error: jest.fn(),
  }
}));

// Mock auth provider
jest.mock('@/components/auth/auth-provider', () => ({
  useAuth: () => ({ user: { id: 'test-user' } })
}));

// Mock fetch
global.fetch = jest.fn();

describe('useChatSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (preferencesCache.get as jest.Mock).mockReturnValue(null);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        preferences: {
          theme: 'dark',
          defaultModel: 'custom-model',
          temperature: 0.8,
          maxTokens: 2000,
          tone: 'professional',
          memoryEnabled: true,
          memorySummaryCount: 10,
          storageEnabled: false,
        }
      }),
    });
  });

  it('should initialize with default settings', () => {
    const { result } = renderHook(() => useChatSettings());

    expect(result.current.settings).toEqual({
      ...DEFAULT_CHAT_SETTINGS,
      model: 'test-model', // From useStarredModels
    });
    expect(result.current.isProcessingStorage).toBe(false);
  });

  it('should load user preferences from cache', () => {
    const cachedPreferences = {
      defaultModel: 'cached-model',
      tone: 'casual',
      memoryEnabled: false,
      memorySummaryCount: 3,
      storageEnabled: true,
    };
    
    (preferencesCache.get as jest.Mock).mockReturnValue(cachedPreferences);

    const { result } = renderHook(() => useChatSettings());

    expect(result.current.settings.model).toBe('cached-model');
    expect(result.current.settings.tone).toBe('casual');
    expect(result.current.settings.memoryEnabled).toBe(false);
    expect(result.current.settings.memorySummaryCount).toBe(3);
    expect(result.current.settings.storageEnabled).toBe(true);
  });

  it('should load user preferences from API', async () => {
    const { result } = renderHook(() => useChatSettings());

    // Wait for API call to complete and settings to update
    await waitFor(() => {
      expect(result.current.settings.model).toBe('custom-model');
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/user/preferences');
    expect(result.current.settings.tone).toBe('professional');
    expect(result.current.settings.memoryEnabled).toBe(true);
  });

  it('should handle settings changes', async () => {
    const { result } = renderHook(() => useChatSettings());

    await act(async () => {
      await result.current.handleSettingsChange({ tone: 'academic' });
    });

    expect(result.current.settings.tone).toBe('academic');
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/user/preferences', expect.objectContaining({
        method: 'PATCH',
        body: expect.stringContaining('"tone":"academic"'),
      }));
    });
  });

  it('should handle model changes', async () => {
    const { result } = renderHook(() => useChatSettings());

    await act(async () => {
      await result.current.handleSettingsChange({ model: 'new-model' });
    });

    expect(result.current.settings.model).toBe('new-model');
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/starred-models/active', expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"modelId":"new-model"'),
      }));
    });
  });

  it('should handle storage toggle', async () => {
    const { result } = renderHook(() => useChatSettings());

    await act(async () => {
      await result.current.handleSettingsChange({ storageEnabled: false });
    });

    expect(result.current.settings.storageEnabled).toBe(false);
    expect(result.current.isProcessingStorage).toBe(false);
  });

  it('should handle API errors gracefully', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
    const mockToast = (useToast as jest.Mock)().toast;

    const { result } = renderHook(() => useChatSettings());

    await act(async () => {
      await result.current.handleSettingsChange({ tone: 'casual' });
    });

    expect(mockToast).toHaveBeenCalledWith({
      title: "Error",
      description: "Failed to update settings. Please try again.",
      variant: "destructive",
    });
    // Settings should still be updated locally
    expect(result.current.settings.tone).toBe('casual');
  });

  it('should update cache when settings change', async () => {
    const { result } = renderHook(() => useChatSettings());

    await act(async () => {
      await result.current.handleSettingsChange({ tone: 'duck' });
    });

    expect(preferencesCache.update).toHaveBeenCalledWith(expect.objectContaining({
      tone: 'duck',
    }));
  });

  it('should handle preferences API failure', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    renderHook(() => useChatSettings());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    expect(logger.error).toHaveBeenCalledWith(
      'Failed to load user preferences:',
      expect.any(Error)
    );
  });

  it('should handle memory settings changes', async () => {
    const { result } = renderHook(() => useChatSettings());

    await act(async () => {
      await result.current.handleSettingsChange({ 
        memoryEnabled: true,
        memorySummaryCount: 7,
      });
    });

    expect(result.current.settings.memoryEnabled).toBe(true);
    expect(result.current.settings.memorySummaryCount).toBe(7);
  });

  it('should not load preferences if no user', () => {
    // Temporarily mock useAuth to return no user
    const originalModule = jest.requireActual('@/components/auth/auth-provider');
    jest.doMock('@/components/auth/auth-provider', () => ({
      ...originalModule,
      useAuth: () => ({ user: null })
    }));

    // Clear module cache to get new mock
    jest.resetModules();
    const { useChatSettings: MockedUseChatSettings } = jest.requireMock('@/hooks/use-chat-settings');
    const { renderHook: mockedRenderHook } = jest.requireMock('@testing-library/react');
    
    // Clear previous fetch calls
    (global.fetch as jest.Mock).mockClear();
    
    mockedRenderHook(() => MockedUseChatSettings());

    expect(global.fetch).not.toHaveBeenCalledWith('/api/user/preferences');
    
    // Restore original mock
    jest.resetModules();
    jest.dontMock('@/components/auth/auth-provider');
  });

  it('should handle concurrent settings updates', async () => {
    const { result } = renderHook(() => useChatSettings());

    // Make multiple concurrent updates
    await act(async () => {
      await Promise.all([
        result.current.handleSettingsChange({ tone: 'casual' }),
        result.current.handleSettingsChange({ memoryEnabled: false }),
        result.current.handleSettingsChange({ storageEnabled: true }),
      ]);
    });

    expect(result.current.settings.tone).toBe('casual');
    expect(result.current.settings.memoryEnabled).toBe(false);
    expect(result.current.settings.storageEnabled).toBe(true);
  });
});