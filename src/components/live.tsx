"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PublicPhase } from "@/server/views";

function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

const label: Record<string, string> = {
  draft: "Not started",
  open: "Trading open",
  paused: "Paused",
  closed: "Trading closed",
  confirmed: "Results being checked",
  published: "Results published",
};

/** Phase status and countdown, synchronised to server time. Refreshes the page when the organiser changes anything. */
export function LiveBar({ initial, serverNow, loginPath = "/login" }: { initial: PublicPhase | null; serverNow: string; loginPath?: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<PublicPhase | null>(initial);
  const [offset, setOffset] = useState(() => new Date(serverNow).getTime() - Date.now());
  const [now, setNow] = useState(() => Date.now());
  const version = useRef<string | null>(null);
  const refreshedAtZero = useRef(false);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const t0 = Date.now();
        const res = await fetch("/api/state", { cache: "no-store" });
        if (res.status === 401) {
          router.push(loginPath);
          return;
        }
        const data = await res.json();
        const rtt = Date.now() - t0;
        setOffset(new Date(data.serverNow).getTime() + rtt / 2 - Date.now());
        setPhase(data.phase);
        if (version.current !== null && version.current !== data.version) router.refresh();
        version.current = data.version;
      } catch {
        /* network blip: keep the last known state and try again */
      }
      if (!stop) timer = setTimeout(poll, phase?.status === "open" || phase?.status === "paused" ? 5000 : 15000);
    };
    poll();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [router, phase?.status]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const remaining = phase?.status === "open" && phase.closesAt ? new Date(phase.closesAt).getTime() - (now + offset) : phase?.status === "paused" ? phase.pausedRemainingMs ?? 0 : null;

  useEffect(() => {
    if (remaining !== null && remaining <= 0 && phase?.status === "open" && !refreshedAtZero.current) {
      refreshedAtZero.current = true;
      setTimeout(() => router.refresh(), 1500);
    }
    if (remaining !== null && remaining > 0) refreshedAtZero.current = false;
  }, [remaining, phase?.status, router]);

  if (!phase) return null;
  const urgent = remaining !== null && remaining < 60_000 && phase.status === "open";
  return (
    <div className="flex items-center gap-3 text-sm" aria-live="polite">
      <span className="hidden text-muted sm:inline">{phase.name}</span>
      <span
        className={`chip ${
          phase.status === "open"
            ? "border-up/40 bg-upsoft text-up"
            : phase.status === "paused"
              ? "border-warn/40 bg-warnsoft text-warn"
              : "border-line bg-panel2 text-muted"
        }`}
      >
        {phase.status === "open" && remaining !== null && remaining <= 0 ? "Trading closed" : label[phase.status]}
      </span>
      {remaining !== null ? (
        <span className={`num rounded-md px-2 py-0.5 font-mono text-base font-semibold ${urgent ? "bg-downsoft text-down" : "bg-panel2"}`}>{fmt(remaining)}</span>
      ) : null}
    </div>
  );
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<string>("dark");
  useEffect(() => setTheme(document.documentElement.dataset.theme ?? "dark"), []);
  const flip = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {}
    setTheme(next);
  };
  return (
    <button type="button" onClick={flip} className="btn btn-sm" aria-label="Switch colour theme">
      {theme === "dark" ? "Light theme" : "Dark theme"}
    </button>
  );
}
