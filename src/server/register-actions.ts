"use server";
import { revalidatePath } from "next/cache";
import { TeamError, createTeam, readTeamForm, validateTeamForm, type FieldErrors, type TeamFormValues } from "./teams";

export interface RegisterState {
  done?: { teamName: string; code: string; members: string[] };
  err?: string;
  errors?: FieldErrors;
  values?: TeamFormValues;
  /** Increases with every failed attempt so the form re-renders with the values that were sent. */
  attempt?: number;
}

/** Public registration. Validates on the server, assigns a unique code and returns it once. */
export async function registerTeam(prev: RegisterState, fd: FormData): Promise<RegisterState> {
  const values = readTeamForm(fd);
  const attempt = (prev.attempt ?? 0) + 1;
  // Hidden field that people never see; automated sign-ups fill it in.
  if (String(fd.get("website") ?? "") !== "") return { err: "Registration could not be completed. Try again", values, attempt };
  const { errors, input } = validateTeamForm(values);
  if (!input) return { err: "Some details need attention. Check the highlighted fields", errors, values, attempt };
  try {
    const { code } = await createTeam(input, "website", "website");
    revalidatePath("/admin/teams");
    return { done: { teamName: input.name, code, members: input.members.map((m) => m.name) } };
  } catch (e) {
    if (e instanceof TeamError) return { err: e.message, errors: e.field ? { [e.field]: e.message } : undefined, values, attempt };
    return { err: "Registration could not be completed. Try again in a moment", values, attempt };
  }
}
