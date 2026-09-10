import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
// `getReactNativePersistence` is exported at runtime from `firebase/auth` for
// React Native, but some SDK versions do not surface it in the type defs.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { getAuth, getReactNativePersistence, initializeAuth, type Auth } from 'firebase/auth';
import { initializeFirestore, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

if (!firebaseConfigured) {
  console.warn(
    '[firebase] Missing EXPO_PUBLIC_FIREBASE_* environment variables. ' +
      'Copy .env.example to .env and fill in your Firebase web config, then restart the dev server.',
  );
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// `initializeAuth` throws if called twice (e.g. after a Fast Refresh); fall back
// to the already-initialised instance in that case.
let authInstance: Auth;
try {
  authInstance = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  authInstance = getAuth(app);
}

// `experimentalForceLongPolling` is required for Firestore streaming to work
// reliably on React Native / Hermes.
let dbInstance: Firestore;
try {
  dbInstance = initializeFirestore(app, {
    experimentalForceLongPolling: true,
  });
} catch {
  // Already initialised (Fast Refresh) — re-import lazily.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getFirestore } = require('firebase/firestore');
  dbInstance = getFirestore(app);
}

export const auth = authInstance;
export const db = dbInstance;
export default app;
