import { DashboardNavbar } from "@/components/DashboardNavbar";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { OnlineHeartbeat } from "@/components/OnlineHeartbeat";
import { AuthGuard } from "@/components/AuthGuard";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div style={{ minHeight: "100vh", background: "#F6F5F4" }}>
        <DashboardNavbar />
        <OnlineHeartbeat />
        <div style={{ display: "flex" }}>
          <DashboardSidebar />
          <main style={{ flex: 1, minWidth: 0 }}>
            {children}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
