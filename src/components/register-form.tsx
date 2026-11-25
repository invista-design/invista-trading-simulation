"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { registerTeam, type RegisterState } from "@/server/register-actions";
import { TeamFields } from "./team-fields";

function Confirmation({ teamName, code, members }: NonNullable<RegisterState["done"]>) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div role="status" aria-live="polite">
      <h2 className="display text-2xl font-bold text-gold">Registration complete</h2>
      <p className="mt-2 text-sm text-muted">
        <span className="font-semibold text-ink">{teamName}</span> is registered.
      </p>
      <div className="my-6 rounded-xl border-2 border-gold px-6 py-7 text-center">
        <div className="text-sm text-muted">Your team code</div>
        <div className="display mt-2 text-6xl font-bold tracking-[0.25em] text-gold" data-testid="team-code">
          {code}
        </div>
        <button type="button" onClick={copy} className="btn btn-sm mt-4">
          {copied ? "Code copied" : "Copy code"}
        </button>
      </div>
      <div className="rounded-lg border border-warn/40 bg-warnsoft p-4 text-sm text-warn">
        <p className="font-semibold">Save this code now.</p>
        <p className="mt-1">
          You log in with your team name and this code. Take a screenshot or write it down and share it with your team members. If you lose it, contact the organisers.
        </p>
      </div>
      <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-muted">Team name</dt>
        <dd className="font-medium">{teamName}</dd>
        <dt className="text-muted">Team code</dt>
        <dd className="font-medium">{code}</dd>
        <dt className="text-muted">Members</dt>
        <dd className="font-medium">{members.join(", ")}</dd>
      </dl>
      <Link href={`/login?team=${encodeURIComponent(teamName)}`} className="btn btn-primary mt-6 w-full py-3 text-base">
        Go to team login
      </Link>
    </div>
  );
}

/**
 * Stays mounted when the page refreshes after a registration, so a team always sees its code,
 * even when its registration took the last place and registration has now closed.
 */
export function RegisterForm({ open, closedMessage }: { open: boolean; closedMessage: string }) {
  const [state, action, pending] = useActionState(registerTeam, {} as RegisterState);
  if (state.done) return <Confirmation {...state.done} />;
  if (!open)
    return (
      <div className="space-y-4 text-sm">
        <h2 className="text-lg font-semibold">Registration is not available</h2>
        <p className="text-muted">{closedMessage}. Already registered? Log in with your team name and team code.</p>
        <Link href="/login" className="btn btn-primary">
          Team login
        </Link>
      </div>
    );
  return (
    <form action={action} className="space-y-6" key={state.attempt ?? 0}>
      {state.err ? (
        <div role="alert" className="rounded-lg border border-down/40 bg-downsoft p-3 text-sm text-down">
          {state.err}
        </div>
      ) : null}
      <TeamFields values={state.values} errors={state.errors} />
      <div className="hidden" aria-hidden="true">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <p className="text-xs text-muted">
        By registering, your team agrees to follow the{" "}
        <Link href="/rulebook" className="underline">
          rulebook
        </Link>
        . Contact details are seen only by the organisers.
      </p>
      <button className="btn btn-primary w-full py-3 text-base" disabled={pending}>
        {pending ? "Registering your team" : "Register team"}
      </button>
    </form>
  );
}
