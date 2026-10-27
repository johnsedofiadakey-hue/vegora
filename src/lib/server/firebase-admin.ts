import "server-only";

import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

export class ServerConfigError extends Error {
  constructor(message = "Store service is not configured") {
    super(message);
    this.name = "ServerConfigError";
  }
}

function getConfiguredApp(): App {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;
  if (!projectId || !clientEmail || !privateKey || !storageBucket) {
    throw new ServerConfigError();
  }

  return getApps().find((app) => app.name === "vegora-server") ?? initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    projectId,
    storageBucket,
  }, "vegora-server");
}

export function storeDb() {
  return getFirestore(getConfiguredApp());
}

export function storeAuth() {
  return getAuth(getConfiguredApp());
}

export function storeBucket() {
  return getStorage(getConfiguredApp()).bucket();
}
