import { randomInt } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuthToken } from "@/lib/firebase/auth";
import { adminDb } from "@/lib/firebase/admin";
import { DEFAULT_STREAK_FIELDS } from "@/lib/firebase/streak";

const RegisterSchema = z.object({
  grade: z.number().int().min(6).max(12).optional(),
  inviteCode: z.string().max(20).optional(),
  birthYear: z.number().int().min(2006).max(2026).optional(),
});

export async function POST(request: NextRequest) {
  const decoded = await verifyAuthToken(request);
  if (!decoded) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { grade, inviteCode, birthYear } = parsed.data;
  const userRef = adminDb.collection("users").doc(decoded.uid);
  const existing = await userRef.get();

  if (existing.exists) {
    return NextResponse.json({
      success: true,
      tier: (existing.data() as Record<string, unknown>).tier ?? "free",
    });
  }

  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const currentYear = now.getFullYear();
  const resolvedBirthYear = birthYear ?? null;
  // isMinor: true = under 18 (DSA compliance: no behavioral profiling)
  // Conservative: assume birthday has not yet occurred this year (matches calcAge logic)
  const isMinor = resolvedBirthYear !== null ? currentYear - resolvedBirthYear - 1 < 18 : null;

  const userData = {
    email: decoded.email ?? null,
    displayName: decoded.name ?? null,
    tier: "free" as const,
    grade: grade ?? null,
    createdAt: now.toISOString(),
    referralCode: generateReferralCode(),
    referredBy: inviteCode ?? null,
    // Age fields — written once at signup, read-only thereafter (see Firestore rules)
    birthYear: resolvedBirthYear,
    isMinor,
    ...DEFAULT_STREAK_FIELDS,
  };

  const usageData = {
    inputTokens: 0,
    outputTokens: 0,
    queryCount: 0,
    lastQueryAt: null,
  };

  const batch = adminDb.batch();
  batch.set(userRef, userData);
  batch.set(userRef.collection("usage").doc(yearMonth), usageData);
  await batch.commit();

  return NextResponse.json({ success: true, tier: "free" });
}

function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[randomInt(chars.length)];
  }
  return code;
}
