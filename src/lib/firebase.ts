import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, initializeFirestore } from 'firebase/firestore';

// Safely access import.meta.env
const metaEnv = (import.meta as any).env || {};

// Official client-side credentials for the Firebase project
const DEFAULT_API_KEY = "AIzaSyDinPE4cXCaM5NDxTYSaeodnBfvMYG0924";
const DEFAULT_PROJECT_ID = "gen-lang-client-0425514709";
const DEFAULT_AUTH_DOMAIN = "gen-lang-client-0425514709.firebaseapp.com";
const DEFAULT_STORAGE_BUCKET = "gen-lang-client-0425514709.firebasestorage.app";
const DEFAULT_MESSAGING_SENDER_ID = "672524116130";
const DEFAULT_APP_ID = "1:672524116130:web:b2ca204c8302cde94af7fb";

const firebaseConfig = {
  apiKey: metaEnv.VITE_FIREBASE_API_KEY || DEFAULT_API_KEY,
  authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN || DEFAULT_AUTH_DOMAIN,
  projectId: metaEnv.VITE_FIREBASE_PROJECT_ID || DEFAULT_PROJECT_ID,
  storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET || DEFAULT_STORAGE_BUCKET,
  messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || DEFAULT_MESSAGING_SENDER_ID,
  appId: metaEnv.VITE_FIREBASE_APP_ID || DEFAULT_APP_ID,
};

// ID реальной Firestore-базы этого проекта (не "(default)" — база названа так при автосоздании через AI Studio)
const FIRESTORE_DATABASE_ID = "ai-studio-baseblobs-b454a390-ce86-4da0-9cdd-300e7ddd380c";

// Initialize Firebase safely
let app: FirebaseApp;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

// Initialize Cloud Firestore using standard method with long polling for robust cross-browser and iframe compatibility
let dbInstance: Firestore;
try {
  dbInstance = initializeFirestore(app, {
    experimentalForceLongPolling: true,
  }, FIRESTORE_DATABASE_ID);
} catch (e) {
  dbInstance = getFirestore(app, FIRESTORE_DATABASE_ID);
}

export const db = dbInstance;