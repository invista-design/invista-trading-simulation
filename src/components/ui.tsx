import type { ReactNode } from "react";
import { tone } from "@/lib/format";

export function PageTitle({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {sub ? <p className="mt-1 text-sm text-muted">{sub}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Card({ title, actions, children, className = "", pad = true }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={`card ${className}`}>
      {title ? (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          {actions}
        </header>
      ) : null}
      <div className={pad ? "p-4" : ""}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, sub, valueClass = "" }: { label: string; value: ReactNode; sub?: ReactNode; valueClass?: string }) {
  return (
    <div className="card px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className={`num mt-1 text-xl font-semibold ${valueClass}`}>{value}</div>
      {sub ? <div className="mt-0.5 text-xs text-muted">{sub}</div> : null}
    </div>
  );
}

const tones = {
  up: "border-up/40 bg-upsoft text-up",
  down: "border-down/40 bg-downsoft text-down",
  warn: "border-warn/40 bg-warnsoft text-warn",
  accent: "border-accent/40 bg-accentsoft text-accent",
  muted: "border-line bg-panel2 text-muted",
} as const;

export function Badge({ children, kind = "muted" }: { children: ReactNode; kind?: keyof typeof tones }) {
  return <span className={`chip ${tones[kind]}`}>{children}</span>;
}

export function PhaseBadge({ status }: { status: string }) {
  const map: Record<string, [string, keyof typeof tones]> = {
    draft: ["Not started", "muted"],
    open: ["Trading open", "up"],
    paused: ["Paused", "warn"],
    closed: ["Closed", "accent"],
    confirmed: ["Results being checked", "accent"],
    published: ["Results published", "muted"],
  };
  const [label, kind] = map[status] ?? [status, "muted"];
  return (
    <Badge kind={kind}>
      {status === "open" ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-up" /> : null}
      {label}
    </Badge>
  );
}

export function Change({ value, children }: { value: number | string; children: ReactNode }) {
  return <span className={`num ${tone(value)}`}>{children}</span>;
}

export function Notice({ ok, err }: { ok?: string; err?: string }) {
  if (!ok && !err) return null;
  return (
    <div role={err ? "alert" : "status"} className={`mb-4 rounded-lg border px-4 py-3 text-sm ${err ? tones.down : tones.up}`}>
      {err ?? ok}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-muted">{children}</div>;
}

export function ReasonField({ placeholder = "Reason (recorded in the audit log)", required = true }: { placeholder?: string; required?: boolean }) {
  return <input name="reason" required={required} minLength={required ? 3 : 0} className="input" placeholder={placeholder} />;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export type SP = Promise<Record<string, string | string[] | undefined>>;
export const sp = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
