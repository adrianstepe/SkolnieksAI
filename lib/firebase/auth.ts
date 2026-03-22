import { NextRequest } from "next/server";
import { adminAuth } from "./admin";
import type { DecodedIdToken } from "firebase-admin/auth";

/**
 * Verifies the Firebase ID token from the Authorization header.
 * Returns the decoded token or null if invalid/missing.
 */
export async function verifyAuthToken(
  request: NextRequest,
): Promise<DecodedIdToken | null> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice(7);
  try {
    return await adminAuth.verifyIdToken(token);
  } catch {
    return null;
  }
}
