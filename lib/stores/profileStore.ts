'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ProfileState {
  profile: any | null;
  isLoading: boolean;
  error: string | null;
  lastFetched: number | null;

  fetchProfile: () => Promise<any>;
  setProfile: (profile: any) => void;
  clearProfile: () => void;
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      profile: null,
      isLoading: false,
      error: null,
      lastFetched: null,

      fetchProfile: async () => {
        set({ isLoading: true, error: null });
        try {
          const res = await fetch('/api/user/profile');
          if (res.ok) {
            const data = await res.json();
            set({ profile: data, isLoading: false, error: null, lastFetched: Date.now() });
            return data;
          } else {
            const err = await res.json().catch(() => ({ error: 'Gagal memuat profil' }));
            set({ isLoading: false, error: err.error || 'Gagal memuat profil' });
            return null;
          }
        } catch (e: any) {
          set({ isLoading: false, error: e.message || 'Terjadi kesalahan' });
          return null;
        }
      },

      setProfile: (profile) => set({ profile, lastFetched: Date.now() }),

      clearProfile: () => set({ profile: null, error: null, lastFetched: null }),
    }),
    {
      name: 'gurupro-profile-store',
      partialize: (state) => ({
        profile: state.profile,
        lastFetched: state.lastFetched,
      }),
    }
  )
);
