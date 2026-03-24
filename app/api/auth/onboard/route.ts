import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/firebase/auth";
import { adminDb } from "@/lib/firebase/admin";
import { z } from "zod";

const OnboardSchema = z.object({
  grade: z.number().int().min(6).max(12),
  subject: z.string().min(1),
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

  const parsed = OnboardSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { grade, subject } = parsed.data;
  const userRef = adminDb.collection("users").doc(decoded.uid);
  
  await userRef.update({
    grade,
    preferredSubject: subject,
    onboardingComplete: true,
  });

  return NextResponse.json({ success: true });
}
