import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  projectId: "jutsu-classroom-mrtin",
  appId: "1:913557328690:web:831831bbd35cd384a67d2b",
  storageBucket: "jutsu-classroom-mrtin.firebasestorage.app",
  // Web API keys are public identifiers (access is gated by authorized
  // domains + key restrictions in GCP), so a valid value is safe to embed
  // as fallback: static prerendering runs without build-time env vars on
  // App Hosting and must never bake an invalid key into the client bundle.
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyALpBmkwjOAH4AaUW0sLS_8suZNns5eu4c",
  authDomain: "jutsu-classroom-mrtin.firebaseapp.com",
  messagingSenderId: "913557328690",
};

export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
export const db = createFirestore();
export const functions = getFunctions(app);

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
