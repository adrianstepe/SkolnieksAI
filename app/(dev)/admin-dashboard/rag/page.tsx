/**
 * app/(dev)/admin-dashboard/rag/page.tsx
 *
 * RAG test harness page — thin shell that renders RagTestPanel.
 * The component itself handles all state and API interaction.
 */

import type { Metadata } from "next";
import RagTestPanel from "@/components/admin/RagTestPanel";

export const metadata: Metadata = {
  title: "RAG Tester — Dev Admin",
};

export default function RagTestPage() {
  return <RagTestPanel />;
}
