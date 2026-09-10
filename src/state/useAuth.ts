import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { useEffect, useState } from 'react';

import { auth, firebaseConfigured } from '../config/firebase';

export type AuthState = {
  uid: string | null;
  ready: boolean;
  error: string | null;
};

/**
 * Signs the device in anonymously (a stable, persisted uid) and keeps `uid` in
 * sync with the Firebase auth state.
 */
export function useAuth(): AuthState {
  const [uid, setUid] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseConfigured) {
      setError('Firebase is not configured. Add your EXPO_PUBLIC_FIREBASE_* values to .env.');
      setReady(true);
      return;
    }

    let cancelled = false;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (cancelled) return;
      if (user) {
        setUid(user.uid);
        setError(null);
        setReady(true);
      } else {
        signInAnonymously(auth).catch((e: unknown) => {
          if (cancelled) return;
          const message =
            e instanceof Error ? e.message : 'Could not sign in to the sync service.';
          setError(message);
          setReady(true);
        });
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return { uid, ready, error };
}
