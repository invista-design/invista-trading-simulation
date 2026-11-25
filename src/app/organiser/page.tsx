import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { Notice, sp, type SP } from "@/components/ui";
import { getSessionUser, login } from "@/lib/auth";

export const metadata = { title: "Organiser sign-in" };
export const dynamic = "force-dynamic";

async function signIn(fd: FormData) {
  "use server";
  const res = await login(String(fd.get("username") ?? ""), String(fd.get("password") ?? ""));
  if (!res.ok) redirect(`/organiser?err=${encodeURIComponent(res.message)}`);
  redirect("/admin");
}

export default async function OrganiserLogin({ searchParams }: { searchParams: SP }) {
  const q = await searchParams;
  const user = await getSessionUser().catch(() => null);
  if (user) redirect(user.role === "organiser" ? "/admin" : "/dashboard");
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Brand name="Market Mayhem - Trading Simulation: Dalal Street Challenge" size={52} />
        </div>
        <h1 className="mb-4 text-center text-xl font-semibold">Organiser sign-in</h1>
        <Notice err={sp(q.err)} ok={sp(q.ok)} />
        <form action={signIn} className="card space-y-4 p-6">
          <label className="block">
            <span className="field-label">Username</span>
            <input name="username" required autoComplete="username" autoCapitalize="none" className="input" />
          </label>
          <label className="block">
            <span className="field-label">Password</span>
            <input name="password" type="password" required autoComplete="current-password" className="input" />
          </label>
          <button className="btn btn-primary w-full">Sign in</button>
        </form>
        <p className="mt-5 text-center text-xs text-muted">
          Competing in a team?{" "}
          <Link href="/login" className="underline">
            Team login
          </Link>
        </p>
      </div>
    </main>
  );
}
