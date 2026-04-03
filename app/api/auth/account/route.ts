import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/firebase/auth";
import { adminDb, adminAuth } from "@/lib/firebase/admin";
import { stripe } from "@/lib/stripe/client";
import type { DocumentReference } from "firebase-admin/firestore";

// ---------------------------------------------------------------------------
// GDPR Article 17 — Right to Erasure
// Hard-deletes ALL user data: usage, conversations, messages, parental consents,
// Stripe customer, Firestore user doc, and the Firebase Auth account.
// ---------------------------------------------------------------------------

/** Batch-delete Firestore document refs in groups of 500 (Firestore limit). */
async function batchDelete(refs: DocumentReference[]): Promise<void> {
  if (refs.length === 0) return;
  const BATCH_SIZE = 500;
  for (let i = 0; i < refs.length; i += BATCH_SIZE) {
    const batch = adminDb.batch();
    refs.slice(i, i + BATCH_SIZE).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

export async function DELETE(request: NextRequest) {
  const decoded = await verifyAuthToken(request);
  if (!decoded) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const uid = decoded.uid;
  const userRef = adminDb.collection("users").doc(uid);

  // 1. Fetch user doc — need stripeCustomerId and email for downstream deletes
  const userDoc = await userRef.get();
  const userData = userDoc.exists
    ? (userDoc.data() as Record<string, unknown>)
    : {};
  const stripeCustomerId = userData.stripeCustomerId as string | undefined;
  const userEmail = userData.email as string | undefined;

  // 2a. Delete all usage subcollection docs
  const usageSnap = await userRef.collection("usage").get();
  await batchDelete(usageSnap.docs.map((d) => d.ref));

  // 2b–c. Conversations + their messages subcollections
  // Firestore .where() without .limit() returns all matching docs.
  const convSnap = await adminDb
    .collection("conversations")
    .where("userId", "==", uid)
    .get();

  for (const convDoc of convSnap.docs) {
    const messagesSnap = await convDoc.ref.collection("messages").get();
    await batchDelete(messagesSnap.docs.map((d) => d.ref));
    await convDoc.ref.delete();
  }

  // 2d. Parental consent records — by parentEmail or childUid (firebaseUid field)
  const consentRefs: DocumentReference[] = [];

  if (userEmail) {
    const byParent = await adminDb
      .collection("parentalConsents")
      .where("parentEmail", "==", userEmail)
      .get();
    byParent.docs.forEach((d) => consentRefs.push(d.ref));
  }

  const byChild = await adminDb
    .collection("parentalConsents")
    .where("firebaseUid", "==", uid)
    .get();
  byChild.docs.forEach((d) => consentRefs.push(d.ref));

  // De-duplicate in case the same doc matched both queries (edge case)
  const uniqueConsentRefs = [...new Map(consentRefs.map((r) => [r.path, r])).values()];
  await batchDelete(uniqueConsentRefs);

  // 2e. Remove Stripe customer (cancels any active subscriptions automatically)
  if (stripeCustomerId) {
    try {
      await stripe.customers.del(stripeCustomerId);
    } catch (err) {
      // Log but don't block — customer may already be deleted in Stripe
      console.error("[account/delete] stripe.customers.del failed:", err);
    }
  }

  // 2f. Delete Firestore user document
  if (userDoc.exists) {
    await userRef.delete();
  }

  // 2g. Delete Firebase Auth account (must be last — invalidates the token)
  await adminAuth.deleteUser(uid);

  return NextResponse.json({ success: true });
}
