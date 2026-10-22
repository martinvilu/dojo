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

/**
 * Con NEXT_PUBLIC_USE_FIREBASE_EMULATORS=1 (tests E2E, desarrollo local) el
 * cliente habla con los emuladores de Auth, Firestore y Functions de un
 * proyecto `demo-*`, que nunca toca recursos reales.
 */
const useEmulators = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "1";
const emulatorHost = process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST || "127.0.0.1";

const firebaseConfig = {
  projectId: useEmulators ? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-ninja-dojo" : "jutsu-classroom-mrtin",
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

if (useEmulators && typeof window !== "undefined" && !(globalThis as any).__dojoEmulatorsConnected) {
  (globalThis as any).__dojoEmulatorsConnected = true;
  connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, emulatorHost, 8080);
  connectFunctionsEmulator(functions, emulatorHost, 5001);
}

/**
 * Browser: IndexedDB cache shared across tabs (replaces the deprecated
 * enableIndexedDbPersistence, which only worked in a single tab and failed
 * with `failed-precondition` in the others). Server: in-memory default.
 */
function createFirestore(): Firestore {
  // En el emulador, sin caché persistente: cada corrida arranca limpia.
  if (typeof window === "undefined" || useEmulators) return getFirestore(app);
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    // Already initialized (e.g. Fast Refresh re-evaluating this module).
    return getFirestore(app);
  }
}
