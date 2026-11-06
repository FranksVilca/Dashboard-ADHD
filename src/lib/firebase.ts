import { initializeApp, getApps } from "firebase/app";
import type { FirebaseApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import type { Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyB4zq_CODfZYi1nYdKTAHtGw6Nc_ienN0w",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "cognitrain-adhd-1234.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "cognitrain-adhd-1234",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "cognitrain-adhd-1234.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "223230939269",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:223230939269:web:9ff10f098ba24e862f19ec",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-YRW4BFNLLH"
};

const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db: Firestore = getFirestore(app);

// Conexión opcional al emulador local de Firestore para pruebas sin dependencia de GCP
if (
  typeof window !== "undefined" &&
  process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true"
) {
  try {
    const host = process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST || "localhost";
    const port = Number(process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_PORT) || 8080;
    connectFirestoreEmulator(db, host, port);
    console.info(`[Firebase] Conectado al emulador de Firestore en ${host}:${port}`);
  } catch {
    // Si ya fue conectado previamente, ignorar excepción de inicialización múltiple
  }
}

export { app, db, firebaseConfig };
