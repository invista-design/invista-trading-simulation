import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { Notice, sp, type SP } from "@/components/ui";
import { getSessionUser, loginTeam } from "@/lib/auth";

export const metadata = { title: "Team login" };
export const dynamic = "force-dynamic";

async function signIn(fd: FormData) {
  "use server";
  const team = String(fd.get("teamName") ?? "");
  const res = await loginTeam(team, String(fd.get("code") ?? ""));
  if (!res.ok) redirect(`/login?team=${encodeURIComponent(team)}&err=${encodeURIComponent(res.message)}`);
  redirect("/dashboard");
}

export default async function LoginPage({ searchParams }: { searchParams: SP }) {
  const q = await searchParams;
  const user = await getSessionUser().catch(() => null);
  if (user) redirect(user.role === "organiser" ? "/admin" : "/dashboard");
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Brand name="Market Mayhem - Trading Simulation: Dalal Street Challenge" size={52} />
        </div>
        <h1 className="mb-4 text-center text-xl font-semibold">Team login</h1>
        <Notice err={sp(q.err)} ok={sp(q.ok)} />
        <form action={signIn} className="card space-y-4 p-6">
          <label className="block">
            <span className="field-label">Team name</span>
            <input name="teamName" required defaultValue={sp(q.team) ?? ""} autoComplete="username" className="input" />
          </label>
          <label className="block">
            <span className="field-label">Team code</span>
            <input
              name="code"
              type="password"
              required
              maxLength={3}
              autoComplete="current-password"
              autoCapitalize="characters"
              placeholder="For example K42"
              className="input uppercase tracking-[0.3em] placeholder:normal-case placeholder:tracking-normal"
            />
            <span className="mt-1 block text-xs text-muted">The 3-character code you received when you registered</span>
          </label>
          <button className="btn btn-primary w-full">Log in</button>
        </form>
        <p className="mt-5 text-center text-sm text-muted">
          Not registered yet?{" "}
          <Link href="/register" className="text-accent underline">
            Register your team
          </Link>
        </p>
        <p className="mt-2 text-center text-xs text-muted">
          <Link href="/organiser" className="underline">
            Organiser sign-in
          </Link>
        </p>
      </div>
    </main>
  );
}
