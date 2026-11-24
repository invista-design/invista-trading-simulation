import crypto from "node:crypto";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Notice, sp, type SP } from "@/components/ui";
import { login } from "@/lib/auth";
import { createFirstOrganiser, organiserCount } from "@/server/setup";

export const metadata = { title: "First-time setup" };
export const dynamic = "force-dynamic";

function tokenMatches(given: string) {
  const expected = process.env.SETUP_TOKEN ?? "";
  if (expected.length < 12) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function runSetup(fd: FormData) {
  "use server";
  const token = String(fd.get("token") ?? "");
  if (!tokenMatches(token)) redirect("/setup?err=The%20setup%20code%20is%20not%20correct");
  const username = String(fd.get("username") ?? "");
  const password = String(fd.get("password") ?? "");
  let err = "";
  try {
    await createFirstOrganiser(username, password, String(fd.get("displayName") ?? ""));
  } catch (e) {
    err = (e as Error).message;
  }
  if (err) redirect(`/setup?err=${encodeURIComponent(err)}`);
  await login(username, password);
  redirect("/admin?ok=Setup%20complete.%20The%20workbook%20defaults%20are%20loaded");
}

export default async function SetupPage({ searchParams }: { searchParams: SP }) {
  const q = await searchParams;
  let organisers = 0;
  let dbError = "";
  try {
    organisers = await organiserCount();
  } catch (e) {
    dbError = (e as Error).message;
  }
  const tokenReady = (process.env.SETUP_TOKEN ?? "").length >= 12;
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <h1 className="mb-1 text-2xl font-semibold">First-time setup</h1>
        <p className="mb-6 text-sm text-muted">Creates the first organiser account and loads the 10 assets, 3 phases, news scores and rulebook from the workbook. Everything can be edited afterwards in the admin panel.</p>
        <Notice err={sp(q.err)} />
        {dbError ? (
          <div className="card p-5 text-sm">
            <p className="font-medium text-down">The database is not reachable.</p>
            <p className="mt-2 text-muted">{dbError}</p>
          </div>
        ) : organisers > 0 ? (
          <div className="card p-5 text-sm">
            Setup is already complete. <Link className="text-accent underline" href="/login">Sign in</Link>.
          </div>
        ) : !tokenReady ? (
          <div className="card p-5 text-sm">
            Add an environment variable named <code className="font-mono">SETUP_TOKEN</code> (at least 12 characters) to the Vercel project, redeploy, then reload this page.
          </div>
        ) : (
          <form action={runSetup} className="card space-y-4 p-6">
            <label className="block">
              <span className="label">Setup code (the SETUP_TOKEN value)</span>
              <input name="token" type="password" required className="input" />
            </label>
            <label className="block">
              <span className="label">Your name</span>
              <input name="displayName" className="input" />
            </label>
            <label className="block">
              <span className="label">Organiser username</span>
              <input name="username" required pattern="[a-zA-Z0-9._-]{3,40}" className="input" autoCapitalize="none" />
            </label>
            <label className="block">
              <span className="label">Password (at least 10 characters)</span>
              <input name="password" type="password" minLength={10} required className="input" autoComplete="new-password" />
            </label>
            <button className="btn btn-primary w-full">Create organiser account</button>
          </form>
        )}
      </div>
    </main>
  );
}
