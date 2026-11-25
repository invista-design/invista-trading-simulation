"use client";
import { useActionState } from "react";
import { addTeam, saveTeamDetails, type TeamFormState } from "@/server/admin-actions";
import type { TeamFormValues } from "@/server/teams";
import { TeamFields } from "./team-fields";

/** Add a team, or edit a team's name and members. Keeps what was typed when something needs fixing. */
export function AdminTeamForm({ mode, teamId, initial }: { mode: "add" | "edit"; teamId?: string; initial?: TeamFormValues }) {
  const [state, action, pending] = useActionState(mode === "add" ? addTeam : saveTeamDetails, {} as TeamFormState);
  const values = state.err ? state.values : mode === "edit" ? (state.values ?? initial) : undefined;
  return (
    <form action={action} className="space-y-5" key={state.attempt ?? 0}>
      {teamId ? <input type="hidden" name="teamId" value={teamId} /> : null}
      {state.ok ? (
        <div role="status" className="rounded-lg border border-up/40 bg-upsoft p-3 text-sm text-up">
          {state.ok}
        </div>
      ) : null}
      {state.err ? (
        <div role="alert" className="rounded-lg border border-down/40 bg-downsoft p-3 text-sm text-down">
          {state.err}
        </div>
      ) : null}
      <TeamFields values={values} errors={state.errors} />
      {mode === "edit" ? <p className="text-xs text-muted">To remove member 3, clear all 3 of their fields. To add member 3, fill them in.</p> : null}
      <input name="reason" required minLength={3} className="input" placeholder="Reason (recorded in the audit log)" />
      <button className="btn btn-primary" disabled={pending}>
        {pending ? "Saving" : mode === "add" ? "Register team" : "Save team details"}
      </button>
    </form>
  );
}
