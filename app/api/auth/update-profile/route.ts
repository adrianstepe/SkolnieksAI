import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/firebase/auth";
import { adminDb } from "@/lib/firebase/admin";
import { z } from "zod";

const UpdateProfileSchema = z.object({
  grade: z.coerce.number().int().min(6).max(12).optional(),
  subject: z.string().min(1).optional(),
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

  const parsed = UpdateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { grade, subject } = parsed.data;
  
  const updates: Record<string, any> = {};
  if (grade !== undefined) updates.grade = grade;
  if (subject !== undefined) updates.preferredSubject = subject;

  // Only run the db write if there is actually data to push
  if (Object.keys(updates).length > 0) {
    try {
      const userRef = adminDb.collection("users").doc(decoded.uid);
      await userRef.update(updates);
    } catch (err) {
      console.error("Failed to update user profile", err);
      return NextResponse.json({ error: "internal_error" }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true, updates });
}
