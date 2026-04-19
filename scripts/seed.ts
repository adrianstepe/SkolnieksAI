/**
 * scripts/seed.ts
 *
 * Seeds test user profiles in Firestore for local development.
 * Creates (or updates) test accounts with different tier levels.
 *
 * Usage:
 *   npm run seed
 *   npm run seed -- --uid <firebase-uid>        # upgrade existing user to premium
 *   npm run seed -- --email <email>             # look up UID by email, then set premium
 */

import { initializeApp, getApps, cert, type ServiceAccount } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// ---------------------------------------------------------------------------
// Init Firebase Admin (reads FIREBASE_SERVICE_ACCOUNT_KEY from .env.local)
// ---------------------------------------------------------------------------

function initAdmin() {
  if (getApps().length > 0) return;
  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!key) {
    console.error('Missing FIREBASE_SERVICE_ACCOUNT_KEY in .env.local');
    process.exit(1);
  }
  initializeApp({ credential: cert(JSON.parse(key) as ServiceAccount) });
}

// ---------------------------------------------------------------------------
// Test accounts to seed (these are created in Firebase Auth if they don't exist)
// ---------------------------------------------------------------------------

const TEST_ACCOUNTS = [
  {
    email: 'test-free@skolnieks.dev',
    password: 'TestFree123!',
    displayName: 'Test Free User',
    tier: 'free' as const,
    grade: 9,
  },
  {
    email: 'test-premium@skolnieks.dev',
    password: 'TestPremium123!',
    displayName: 'Test Premium User',
    tier: 'premium' as const,
    grade: 10,
  },
  {
    email: 'test-pro@skolnieks.dev',
    password: 'TestPro123!',
    displayName: 'Test Pro User',
    tier: 'pro' as const,
    grade: 11,
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  initAdmin();
  const auth = getAuth();
  const db = getFirestore();

  const args = process.argv.slice(2);
  const uidFlag = args.indexOf('--uid');
  const emailFlag = args.indexOf('--email');

  // --uid <uid>: upgrade a specific existing user to premium
  if (uidFlag !== -1 && args[uidFlag + 1]) {
    const uid = args[uidFlag + 1]!;
    await db.doc(`users/${uid}`).set(
      { tier: 'premium', updatedAt: Timestamp.now() },
      { merge: true }
    );
    console.log(`✓ Set users/${uid} → tier: premium`);
    return;
  }

  // --email <email>: look up UID by email, set premium
  if (emailFlag !== -1 && args[emailFlag + 1]) {
    const email = args[emailFlag + 1]!;
    const user = await auth.getUserByEmail(email).catch(() => null);
    if (!user) {
      console.error(`No Firebase Auth user found for email: ${email}`);
      process.exit(1);
    }
    await db.doc(`users/${user.uid}`).set(
      { tier: 'premium', updatedAt: Timestamp.now() },
      { merge: true }
    );
    console.log(`✓ Set users/${user.uid} (${email}) → tier: premium`);
    return;
  }

  // Default: create/update all test accounts
  console.log('Seeding test accounts...\n');

  for (const account of TEST_ACCOUNTS) {
    // Create or get existing Firebase Auth user
    let uid: string;
    const existing = await auth.getUserByEmail(account.email).catch(() => null);
    if (existing) {
      uid = existing.uid;
      console.log(`  Found existing auth user: ${account.email} (${uid})`);
    } else {
      const created = await auth.createUser({
        email: account.email,
        password: account.password,
        displayName: account.displayName,
        emailVerified: true,
      });
      uid = created.uid;
      console.log(`  Created auth user: ${account.email} (${uid})`);
    }

    // Upsert Firestore profile
    await db.doc(`users/${uid}`).set(
      {
        email: account.email,
        displayName: account.displayName,
        tier: account.tier,
        grade: account.grade,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    );
    console.log(`  ✓ Firestore profile: tier=${account.tier}, grade=${account.grade}\n`);
  }

  console.log('Done! Test credentials:');
  for (const a of TEST_ACCOUNTS) {
    console.log(`  [${a.tier.padEnd(7)}]  ${a.email}  /  ${a.password}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
