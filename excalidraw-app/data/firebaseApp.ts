import { getApp, getApps, initializeApp } from "firebase/app";

let firebaseConfig: Record<string, unknown>;
try {
  firebaseConfig = JSON.parse(import.meta.env.VITE_APP_FIREBASE_CONFIG);
} catch {
  firebaseConfig = {};
}

export const getFirebaseApp = () =>
  getApps().length ? getApp() : initializeApp(firebaseConfig);
