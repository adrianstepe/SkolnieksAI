import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/firebase/auth";
import { adminDb } from "@/lib/firebase/admin";

/** GET /api/conversations/[id]/messages — load all messages for a conversation */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const decoded = await verifyAuthToken(request);
  if (!decoded) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Verify the conversation belongs to this user
  const convDoc = await adminDb.collection("conversations").doc(id).get();
  if (!convDoc.exists) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const convData = convDoc.data() as Record<string, unknown>;
  if (convData.userId !== decoded.uid) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const messagesSnap = await adminDb
    .collection("conversations")
    .doc(id)
    .collection("messages")
    .orderBy("createdAt", "asc")
    .get();

  const messages = messagesSnap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      role: data.role as string,
      content: data.content as string,
    };
  });

  return NextResponse.json({
    conversation: {
      id: convDoc.id,
      subject: convData.subject,
      grade: convData.grade,
    },
    messages,
  });
}
