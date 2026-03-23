import {
  initializeApp,
  getApps,
  cert,
  type App,
  type ServiceAccount,
} from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

// ---------------------------------------------------------------------------
// Lazy initializer — called on first property access, NOT at module load time.
// This prevents Next.js build failures when env vars aren't set during static
// page collection.
// ---------------------------------------------------------------------------

function getAdminApp(): App {
  const existing = getApps();
  if (existing.length > 0) return existing[0]!;

  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!key) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set",
    );
  }

  return initializeApp({
    credential: cert(JSON.parse(key) as ServiceAccount),
  });
}

// Proxy objects that look identical to the old exports — no callers need changing.
// Initialization is deferred until the first property access (i.e. first request).
export const adminApp: App = new Proxy({} as App, {
  get: (_, prop) => Reflect.get(getAdminApp(), prop as string),
});

export const adminAuth: Auth = new Proxy({} as Auth, {
  get: (_, prop) => Reflect.get(getAuth(getAdminApp()), prop as string),
});

export const adminDb: Firestore = new Proxy({} as Firestore, {
  get: (_, prop) => Reflect.get(getFirestore(getAdminApp()), prop as string),
});
