import { Shell } from "@/components/shell";
import { requireTeam } from "@/lib/auth";

export const dynamic = "force-dynamic";

const nav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/markets", label: "Markets" },
  { href: "/companies", label: "Company profiles" },
  { href: "/news", label: "News" },
  { href: "/trade", label: "Trade" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/orders", label: "Orders" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/rules", label: "Rules and help" },
];

export default async function TeamLayout({ children }: { children: React.ReactNode }) {
  const user = await requireTeam();
  return (
    <Shell nav={nav} who={user.displayName} role="team">
      {children}
    </Shell>
  );
}
