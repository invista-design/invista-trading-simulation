import { Shell } from "@/components/shell";
import { requireOrganiser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const nav = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/phases", label: "Phases and round control" },
  { href: "/admin/teams", label: "Registered teams" },
  { href: "/admin/assets", label: "Assets and companies" },
  { href: "/admin/news", label: "News and market impact" },
  { href: "/admin/rules", label: "Rules and rulebook" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/analytics", label: "Market analytics" },
  { href: "/admin/leaderboards", label: "Leaderboards" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/audit", label: "Audit log" },
  { href: "/admin/settings", label: "Settings" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireOrganiser();
  return (
    <Shell nav={nav} who={`${user.displayName} (organiser)`} role="organiser">
      {children}
    </Shell>
  );
}
