import Link from "next/link";
import type { ReactNode } from "react";
import { getDb } from "@/db";
import { currentPhase, getCompetition, getPhases, settleAutoClose } from "@/server/core";
import { publicPhase } from "@/server/views";
import { LiveBar, ThemeToggle } from "./live";
import { NavLinks } from "./nav-links";

export interface NavItem {
  href: string;
  label: string;
}

export async function Shell({ nav, who, role, children }: { nav: NavItem[]; who: string; role: "team" | "organiser"; children: ReactNode }) {
  const db = getDb();
  await settleAutoClose(db);
  const [comp, phases] = await Promise.all([getCompetition(db), getPhases(db)]);
  const cur = currentPhase(phases);
  return (
    <div className="min-h-screen lg:flex">
      <aside className="border-b border-line bg-panel lg:sticky lg:top-0 lg:h-screen lg:w-60 lg:shrink-0 lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between px-4 py-4 lg:block">
          <Link href={role === "organiser" ? "/admin" : "/dashboard"} className="block">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">{comp.organiser}</div>
            <div className="text-base font-semibold leading-tight">{comp.name}</div>
            <div className="text-xs text-muted">{role === "organiser" ? "Admin panel" : comp.roundName}</div>
          </Link>
        </div>
        <NavLinks items={nav} />
      </aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-panel/95 px-4 py-2.5 backdrop-blur lg:px-6">
          <LiveBar initial={cur ? publicPhase(cur) : null} serverNow={new Date().toISOString()} />
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden max-w-48 truncate text-muted sm:inline">{who}</span>
            <ThemeToggle />
            <form action="/logout" method="post">
              <button className="btn btn-sm">Sign out</button>
            </form>
          </div>
        </header>
        <main className="mx-auto max-w-[1400px] px-4 py-6 lg:px-6">{children}</main>
      </div>
    </div>
  );
}
