'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ProfileState {
  profile: any | null;
  isLoading: boolean;
  error: string | null;
  lastFetched: number | null;
  cachedUserId: string | null;
  isInitialized: boolean;

  fetchProfile: () => Promise<any>;
  setProfile: (profile: any) => void;
  clearProfile: () => void;
  validateSession: () => Promise<boolean>;
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      profile: null,
      isLoading: false,
      error: null,
      lastFetched: null,
      cachedUserId: null,
      isInitialized: false,

      fetchProfile: async () => {
        set({ isLoading: true, error: null });
        try {
          // Skip session validation on first fetch - just get profile directly
          // The session cookie should be automatically sent with fetch requests
          const res = await fetch('/api/user/profile', {
            credentials: 'include'
          });

          if (res.ok) {
            const data = await res.json();
            set({
              profile: data,
              cachedUserId: data.id,
              isLoading: false,
              error: null,
              lastFetched: Date.now(),
              isInitialized: true
            });
            return data;
          } else {
            const err = await res.json().catch(() => ({ error: 'Gagal memuat profil' }));
            // If 401, clear profile and redirect to login
            if (res.status === 401) {
              set({
                profile: null,
                cachedUserId: null,
                isLoading: false,
                error: null,
                lastFetched: Date.now(),
                isInitialized: true
              });
            } else {
              set({
                isLoading: false,
                error: err.error || 'Gagal memuat profil',
                lastFetched: Date.now(),
                isInitialized: true
              });
            }
            return null;
          }
        } catch (e: any) {
          console.error('[ProfileStore] Error:', e);
          set({
            isLoading: false,
            error: e.message || 'Terjadi kesalahan',
            lastFetched: Date.now(),
            isInitialized: true
          });
          return null;
        }
      },

      setProfile: (profile) => set({
        profile,
        cachedUserId: profile?.id || null,
        lastFetched: Date.now()
      }),

      clearProfile: () => set({
        profile: null,
        cachedUserId: null,
        error: null,
        lastFetched: null
      }),

      validateSession: async () => {
        try {
          const res = await fetch('/api/auth/active-context', {
            credentials: 'include'
          });

          if (!res.ok) {
            return false;
          }

          const sessionData = await res.json();
          const sessionUserId = sessionData.userId;
          const cachedUserId = get().cachedUserId;

          // Session doesn't match cached user
          if (sessionUserId && cachedUserId && String(sessionUserId) !== String(cachedUserId)) {
            console.log('[ProfileStore] Session changed - invalidating cache');
            set({ profile: null, cachedUserId: null });
            return false;
          }

          return true;
        } catch (e) {
          console.error('[ProfileStore] Session validation error:', e);
          return false;
        }
      },
    }),
    {
      name: 'gurupro-profile-store',
      partialize: (state) => ({
        profile: state.profile,
        cachedUserId: state.cachedUserId,
        lastFetched: state.lastFetched,
      }),
    }
  )
);
