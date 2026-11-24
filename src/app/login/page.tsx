import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, login } from "@/lib/auth";
import { Notice, sp, type SP } from "@/components/ui";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

async function signIn(fd: FormData) {
  "use server";
  const res = await login(String(fd.get("username") ?? ""), String(fd.get("password") ?? ""));
  if (!res.ok) redirect(`/login?err=${encodeURIComponent(res.message)}`);
  const next = String(fd.get("next") ?? "");
  redirect(res.user.role === "organiser" ? (next.startsWith("/admin") ? next : "/admin") : "/dashboard");
}

export default async function LoginPage({ searchParams }: { searchParams: SP }) {
  const q = await searchParams;
  const user = await getSessionUser().catch(() => null);
  if (user) redirect(user.role === "organiser" ? "/admin" : "/dashboard");
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 block text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">InVista</div>
          <div className="text-2xl font-semibold">Trading Simulation</div>
        </Link>
        <Notice err={sp(q.err)} ok={sp(q.ok)} />
        <form action={signIn} className="card space-y-4 p-6">
          <input type="hidden" name="next" value={sp(q.next) ?? ""} />
          <label className="block">
            <span className="label">Username</span>
            <input name="username" required autoComplete="username" autoCapitalize="none" className="input" />
          </label>
          <label className="block">
            <span className="label">Password</span>
            <input name="password" type="password" required autoComplete="current-password" className="input" />
          </label>
          <button className="btn btn-primary w-full">Sign in</button>
          <p className="text-center text-xs text-muted">Teams receive their username and password from the organisers.</p>
        </form>
      </div>
    </main>
  );
}
