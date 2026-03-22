import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/firebase/auth";
import { adminDb } from "@/lib/firebase/admin";

/** GET /api/conversations — list user's recent conversations */
export async function GET(request: NextRequest) {
  const decoded = await verifyAuthToken(request);
  if (!decoded) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const snapshot = await adminDb
    .collection("conversations")
    .where("userId", "==", decoded.uid)
    .orderBy("updatedAt", "desc")
    .limit(20)
    .get();

  const conversations = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      title: data.title as string,
      subject: data.subject as string,
      grade: data.grade as number,
      updatedAt: data.updatedAt as string,
    };
  });

  return NextResponse.json({ conversations });
}
