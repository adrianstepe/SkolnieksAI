import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import {
  getAnalytics,
  isSupported,
  logEvent,
  type Analytics,
} from "firebase/analytics";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

let analyticsInstance: Analytics | null = null;

// Analytics is browser-only and requires measurement ID
if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) {
      analyticsInstance = getAnalytics(app);
    }
  });
}

export type AuthAnalyticsMethod = "email" | "google";

/** Logs sign_up / login when Analytics is supported (browser + measurement ID). Fire-and-forget safe. */
export async function logAuthAnalyticsEvent(
  eventName: "sign_up" | "login",
  method: AuthAnalyticsMethod,
): Promise<void> {
  if (typeof window === "undefined") return;
  const supported = await isSupported().catch(() => false);
  if (!supported) return;
  try {
    logEvent(getAnalytics(app), eventName, { method });
  } catch {
    // Missing measurement ID or other init failure — do not break auth flow
  }
}

/** Generic Analytics event; omits undefined param values. Safe when unsupported or init fails. */
export async function logAnalyticsEvent(
  eventName: string,
  params?: Record<string, string | number | boolean | undefined>,
): Promise<void> {
  if (typeof window === "undefined") return;
  const supported = await isSupported().catch(() => false);
  if (!supported) return;
  try {
    const payload: Record<string, string | number | boolean> = {};
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) payload[key] = value;
      }
    }
    logEvent(getAnalytics(app), eventName, payload);
  } catch {
    // Missing measurement ID or other init failure
  }
}

export { app, auth, db, googleProvider, analyticsInstance as analytics };
