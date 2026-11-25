import Link from "next/link";
import { Brand } from "@/components/brand";
import { RegisterForm } from "@/components/register-form";
import { getCompetition } from "@/server/core";
import { registrationState } from "@/server/teams";
import { getDb } from "@/db";
import { splitTitle } from "@/lib/format";

export const metadata = { title: "Register your team" };
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const db = getDb();
  const [comp, reg] = await Promise.all([getCompetition(db), registrationState(db)]);
  const [title, subtitle] = splitTitle(comp.name);
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5">
        <Brand name={comp.name} size={44} sub="InVista, International Management Institute New Delhi" />
        <Link href="/login" className="btn">
          Team login
        </Link>
      </header>
      <main className="mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-4 lg:grid-cols-[1fr_1.15fr]">
        <section className="lg:sticky lg:top-8 lg:self-start">
          <p className="display text-3xl font-bold text-gold sm:text-4xl">{title}</p>
          {subtitle ? <p className="mt-2 text-lg font-medium">{subtitle}</p> : null}
          <h1 className="mt-8 text-2xl font-semibold">Register your team</h1>
          <ul className="mt-4 space-y-3 text-sm text-muted">
            <li>Your team has 2 or 3 members. Member 3 is optional.</li>
            <li>For each member, have the full name, a 10-digit mobile number and an email ID ready.</li>
            <li>Choose a team name that no other team uses. You log in with this name.</li>
            <li>After registering you get a team code such as K42. Your team name and this code are your login.</li>
          </ul>
          <p className={`mt-6 text-sm ${reg.open ? "text-up" : "text-down"}`}>
            {reg.open ? `Registration is open. ${reg.registered} of ${reg.capacity} places taken.` : `${reg.message}.`}
          </p>
        </section>
        <section className="card p-5 sm:p-7">
          <RegisterForm open={reg.open} closedMessage={reg.message} />
        </section>
      </main>
    </div>
  );
}
