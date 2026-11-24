"use client";
import { useActionState, type ReactNode } from "react";

type Creds = { team: string; username: string; password: string }[];
type State = { ok?: string; err?: string; credentials?: Creds };

/** Form for actions that return one-time passwords. Passwords are shown once and can be downloaded. */
export function CredentialForm({ action, submitLabel, children, className = "" }: { action: (prev: State, fd: FormData) => Promise<State>; submitLabel: string; children: ReactNode; className?: string }) {
  const [state, formAction, pending] = useActionState(action, {});
  const download = (c: Creds) => {
    const csv = ["Team,Username,Password", ...c.map((x) => [x.team, x.username, x.password].map((v) => `"${v.replace(/"/g, '""')}"`).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "team-logins.csv";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className={className}>
      <form action={formAction} className="space-y-3">
        {children}
        <button className="btn btn-primary" disabled={pending}>
          {pending ? "Working" : submitLabel}
        </button>
      </form>
      {state.err ? <div className="mt-3 rounded-lg border border-down/40 bg-downsoft p-3 text-sm text-down">{state.err}</div> : null}
      {state.ok ? <div className="mt-3 rounded-lg border border-up/40 bg-upsoft p-3 text-sm text-up">{state.ok}</div> : null}
      {state.credentials?.length ? (
        <div className="mt-3 overflow-x-auto rounded-lg border border-warn/50">
          <table className="tbl">
            <thead>
              <tr>
                <th>Team</th>
                <th>Username</th>
                <th>Password (shown once)</th>
              </tr>
            </thead>
            <tbody>
              {state.credentials.map((c) => (
                <tr key={c.username}>
                  <td>{c.team}</td>
                  <td className="font-mono">{c.username}</td>
                  <td className="font-mono">{c.password}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-3">
            <button type="button" className="btn btn-sm" onClick={() => download(state.credentials!)}>
              Download as spreadsheet (.csv)
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
