"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";

let emulatorConnected = false;

export function adminAuth() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
  if (!apiKey || !authDomain || !projectId || !appId) return null;
  const app = getApps().length ? getApp() : initializeApp({ apiKey, authDomain, projectId, appId });
  const auth = getAuth(app);
  // Local testing only: set at build time to sign in against the Firebase Auth
  // emulator instead of the real project. Unset in every real deployment.
  const emulator = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;
  if (emulator && !emulatorConnected) {
    connectAuthEmulator(auth, `http://${emulator}`, { disableWarnings: true });
    emulatorConnected = true;
  }
  return auth;
}
