import { DashboardNavbar } from "@/components/DashboardNavbar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F6F5F4" }}>
      <DashboardNavbar />
      {children}
    </div>
  );
}
