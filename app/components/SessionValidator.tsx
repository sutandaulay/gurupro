"use client";

import { useEffect, useRef } from "react";
import { useProfileStore, useTeacherStore } from "@/lib/stores";

/**
 * SessionValidator
 * Runs on app mount to validate that cached data matches current session.
 * Prevents showing stale data from a different user's session.
 *
 * Only validates if there's existing cached data - avoids clearing fresh sessions.
 */
export default function SessionValidator() {
  const validateSession = useProfileStore(s => s.validateSession);
  const clearProfile = useProfileStore(s => s.clearProfile);
  const resetContext = useTeacherStore(s => s.resetContext);
  const profile = useProfileStore(s => s.profile);
  const cachedUserId = useProfileStore(s => s.cachedUserId);
  const initialized = useRef(false);

  useEffect(() => {
    // Skip validation on first render - just mark as initialized
    // Only validate if there's existing cached data from a previous session
    if (!initialized.current) {
      initialized.current = true;
      // Don't validate on first load - just mark as initialized
      return;
    }

    async function validate() {
      // Only validate if we have cached data that needs to be checked
      if (!profile && !cachedUserId) {
        console.log('[SessionValidator] No cached data, skipping validation');
        return;
      }

      try {
        const isValid = await validateSession();

        if (!isValid) {
          // Session is invalid or changed - clear all cached data
          console.log('[SessionValidator] Session invalid or changed - clearing caches');

          // Clear all localStorage that might contain stale user data
          if (typeof window !== 'undefined') {
            const keysToRemove: string[] = [];

            // Find and clear profile-related keys
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key && (key.includes('profile') || key.includes('session') || key.includes('auth'))) {
                keysToRemove.push(key);
              }
            }

            keysToRemove.forEach(key => {
              try {
                localStorage.removeItem(key);
              } catch (e) {
                console.error(`Failed to remove ${key}:`, e);
              }
            });

            // Clear sessionStorage
            sessionStorage.clear();
          }

          // Clear stores
          clearProfile();
          resetContext();
        }
      } catch (err) {
        console.error('[SessionValidator] Validation error:', err);
        // On error, be safe but only clear if we have cached data
        if (profile || cachedUserId) {
          clearProfile();
          resetContext();
        }
      }
    }

    validate();
  }, [profile, cachedUserId]);

  return null;
}
