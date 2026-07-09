import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

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

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore with offline persistent cache enabled
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

