import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
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
export const db = getFirestore(app);
export const functions = getFunctions(app);

import { enableIndexedDbPersistence } from "firebase/firestore";
if (typeof window !== "undefined") {
  enableIndexedDbPersistence(db).catch((err) => {
    console.warn("Firestore offline persistence error/precondition:", err.code);
  });
}
