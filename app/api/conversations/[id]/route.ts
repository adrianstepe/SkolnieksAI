import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/firebase/auth";
import { adminDb } from "@/lib/firebase/admin";

/** DELETE /api/conversations/[id] — delete a conversation and all its messages */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const decoded = await verifyAuthToken(request);
  if (!decoded) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const convRef = adminDb.collection("conversations").doc(id);
  const convDoc = await convRef.get();

  if (!convDoc.exists) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const convData = convDoc.data() as Record<string, unknown>;
  if (convData.userId !== decoded.uid) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Delete all messages in the subcollection first
  const messagesSnap = await convRef.collection("messages").get();
  const batch = adminDb.batch();
  for (const doc of messagesSnap.docs) {
    batch.delete(doc.ref);
  }
  batch.delete(convRef);
  await batch.commit();

  return NextResponse.json({ success: true });
}
