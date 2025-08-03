'use client';

import { useEffect, useRef } from 'react';
import { preferencesCache, type CachedUserPreferences } from '@/lib/local-preferences-cache';
import { sessionCache } from '@/lib/local-session-cache';
import { cachedFetch } from '@/lib/request-cache';
import { useAuth } from '@/components/auth/auth-provider';
import { logger } from '@/lib/logger';

/**
 * useBootstrapPreload
 * Warms critical client caches as soon as the user is known.
 * - Seeds from localStorage synchronously
 * - Triggers background SWR revalidation with request dedupe
 * - Never blocks rendering
 */
export function useBootstrapPreload() {
  const { user } = useAuth();
  const startedRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    if (startedRef.current) return;
    startedRef.current = true;

    try {
      // 1) Seed from localStorage for instant UI
      try {
        preferencesCache.get(); // ensures localStorage read into memory
      } catch {
        // ignore
      }
      try {
        sessionCache.get(); // ensures localStorage read into memory
      } catch {
        // ignore
      }

      // 2) Background SWR revalidation (non-blocking)
      // Use request-cache where possible to dedupe and apply TTLs
      const load = async (): Promise<void> => {
        try {
          const sessionsPromise = cachedFetch.sessions(50)
            .then(async (data: { sessions?: Array<{ id: string; title?: string; updated_at: string; messages?: Array<{ content: string; role: string }>; settings?: { model?: string } }> } | null) => {
              // Normalize and store in session cache
              if (data && Array.isArray(data.sessions)) {
                const cached = sessionCache.fromApiResponse(data.sessions);
                sessionCache.set(cached, user.id);
              }
            })
            .catch((err: unknown) => {
              logger.dev.warn('Preload: sessions fetch failed', err);
            });

          const userPrefsPromise = cachedFetch.userPreferences()
            .then((data: { preferences?: Record<string, unknown> } | null) => {
              if (!data) return;
              const existing: CachedUserPreferences = preferencesCache.get() || preferencesCache.getDefaults(user.id);
              const fromApi = preferencesCache.fromUserPreferencesAPI(
                (data.preferences ?? {}) as {
                  starred_models?: string[];
                  default_model?: string;
                  theme?: string;
                  sidebar_collapsed?: boolean;
                }
              );
              const toSet: CachedUserPreferences = { ...existing, ...fromApi };
              preferencesCache.set(toSet, user.id);
            })
            .catch((err: unknown) => {
              logger.dev.warn('Preload: user preferences fetch failed', err);
            });

          // Optional: learning preferences (if heavy, allow it to be lazy)
          const learningPrefsPromise = fetch('/api/learning-preferences')
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error('learning prefs failed'))))
            .then((data: { preferences?: Record<string, unknown> } | null) => {
              const prefs = data?.preferences ?? {};
              preferencesCache.updateLearningPreferences(prefs);
            })
            .catch(() => {
              // keep silent to avoid noisy logs and type issues
              // learning preferences are optional for preload
            });

          // Optional: starred-models endpoint consolidates preferences too
          const starredPromise = cachedFetch.starredModels()
            .then((data: { starredModels?: string[]; primaryModel?: string } | null) => {
              if (!data) return;
              const starred = Array.isArray(data.starredModels) ? data.starredModels : [];
              const primary = data.primaryModel;
              const updates: Partial<CachedUserPreferences> = {};
              if (starred.length) updates.starredModels = starred;
              if (primary) updates.defaultModel = primary;
              if (Object.keys(updates).length > 0) {
                preferencesCache.update(updates);
              }
            })
            .catch(() => {
              // silent; optional during preload
            });

          await Promise.allSettled<void>([
            sessionsPromise,
            userPrefsPromise,
            learningPrefsPromise,
            starredPromise,
          ]);
          logger.dev.log('Preload complete');
        } catch (e) {
          logger.dev.warn('Preload failed', e);
        }
      };

      // Defer network work until after first paint
      // Narrowly type requestIdleCallback if present without using any
      const w = window as unknown as {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
        cancelIdleCallback?: (id: number) => void;
        setTimeout: (handler: () => void, timeout?: number) => number;
        clearTimeout: (id: number) => void;
      };

      const id: number = w.requestIdleCallback
        ? w.requestIdleCallback(load, { timeout: 2000 })
        : w.setTimeout(load, 0);

      return () => {
        if (w.cancelIdleCallback && typeof id === 'number') {
          w.cancelIdleCallback(id);
        } else {
          w.clearTimeout(id);
        }
      };
    } catch (e) {
      logger.dev.warn('Bootstrap preload encountered an error', e);
    }
  }, [user]);
}
