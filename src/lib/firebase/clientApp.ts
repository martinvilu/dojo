import { initializeApp, getApps } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";

// Proyecto por entorno (mejora 3.36): producción por defecto; staging o
// desarrollo se eligen con las variables NEXT_PUBLIC_FIREBASE_*.
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "jutsu-classroom-mrtin";

const firebaseConfig = {
  projectId,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:913557328690:web:831831bbd35cd384a67d2b",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${projectId}.firebasestorage.app`,
  // Web API keys are public identifiers (access is gated by authorized
  // domains + key restrictions in GCP), so a valid value is safe to embed
  // as fallback: static prerendering runs without build-time env vars on
  // App Hosting and must never bake an invalid key into the client bundle.
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyALpBmkwjOAH4AaUW0sLS_8suZNns5eu4c",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "913557328690",
};

/** `npm run dev:emulators`: Auth, Firestore y Functions locales. */
export const usingEmulators = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";

export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
export const db = createFirestore();
export const functions = getFunctions(app);

if (usingEmulators && typeof window !== "undefined" && !(globalThis as any).__dojoEmulatorsConnected) {
  (globalThis as any).__dojoEmulatorsConnected = true;
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}

/**
 * Browser: IndexedDB cache shared across tabs (replaces the deprecated
 * enableIndexedDbPersistence, which only worked in a single tab and failed
 * with `failed-precondition` in the others). Server: in-memory default.
 */
function createFirestore(): Firestore {
  if (typeof window === "undefined") return getFirestore(app);
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    // Already initialized (e.g. Fast Refresh re-evaluating this module).
    return getFirestore(app);
  }
}
