import AdminSidebar from "@/components/admin/AdminSidebar";

export const metadata = {
  title: "Dev Admin — SkolnieksAI",
};

export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full min-h-screen bg-base">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto thin-scrollbar p-8">
        {children}
      </main>
    </div>
  );
}
