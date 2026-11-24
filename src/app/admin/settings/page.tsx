import { eq } from "drizzle-orm";
import { CredentialForm } from "@/components/credential-form";
import { Card, Notice, PageTitle, ReasonField, sp, type SP } from "@/components/ui";
import { getDb, schema } from "@/db";
import { requireOrganiser } from "@/lib/auth";
import { dateTime } from "@/lib/format";
import { addOrganiser, changeOwnPassword, saveSettings, setOrganiserActive } from "@/server/admin-actions";
import { getCompetition } from "@/server/core";

export const metadata = { title: "Settings" };

export default async function Settings({ searchParams }: { searchParams: SP }) {
  const q = await searchParams;
  const me = await requireOrganiser();
  const db = getDb();
  const [comp, organisers] = await Promise.all([getCompetition(db), db.select().from(schema.users).where(eq(schema.users.role, "organiser"))]);
  return (
    <>
      <PageTitle title="Settings" />
      <Notice ok={sp(q.ok)} err={sp(q.err)} />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Competition">
          <form action={saveSettings} className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="label">Competition name</span>
              <input name="name" defaultValue={comp.name} className="input" />
            </label>
            <label>
              <span className="label">Organising club</span>
              <input name="organiser" defaultValue={comp.organiser} className="input" />
            </label>
            <label>
              <span className="label">Round name</span>
              <input name="roundName" defaultValue={comp.roundName} className="input" />
            </label>
            <label>
              <span className="label">Team capacity</span>
              <input name="teamCapacity" defaultValue={comp.teamCapacity} className="input" />
            </label>
            <label className="sm:col-span-2">
              <span className="label">Instagram page for news packs</span>
              <input name="instagramUrl" defaultValue={comp.instagramUrl} className="input" placeholder="https://www.instagram.com/..." />
            </label>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" name="showDemandAfterPublish" defaultChecked={comp.showDemandAfterPublish} /> After publishing, show teams the total lots bought and sold per asset
            </label>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" name="showMarketParameters" defaultChecked={comp.showMarketParameters} /> After publishing, also show teams each asset&apos;s supply
            </label>
            <div className="sm:col-span-2">
              <ReasonField />
            </div>
            <button className="btn btn-primary">Save settings</button>
          </form>
        </Card>
        <div className="space-y-4">
          <Card title="Organiser accounts">
            <ul className="mb-4 space-y-2 text-sm">
              {organisers.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <span className="font-medium">{o.displayName}</span> <span className="font-mono text-xs text-muted">{o.username}</span>
                    <span className="block text-xs text-muted">Last sign-in {o.lastLoginAt ? dateTime(o.lastLoginAt) : "never"}{o.active ? "" : " · deactivated"}</span>
                  </span>
                  {o.id !== me.id ? (
                    <form action={setOrganiserActive} className="flex gap-2">
                      <input type="hidden" name="userId" value={o.id} />
                      <input type="hidden" name="active" value={o.active ? "false" : "true"} />
                      <input name="reason" required className="input w-40" placeholder="Reason" />
                      <button className="btn btn-sm">{o.active ? "Deactivate" : "Activate"}</button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
            <CredentialForm action={addOrganiser} submitLabel="Add organiser">
              <div className="grid gap-2 sm:grid-cols-2">
                <input name="username" required className="input" placeholder="Username" />
                <input name="displayName" className="input" placeholder="Name" />
              </div>
              <ReasonField />
            </CredentialForm>
          </Card>
          <Card title="Change my password">
            <CredentialForm action={changeOwnPassword} submitLabel="Change password">
              <input name="current" type="password" required className="input" placeholder="Current password" autoComplete="current-password" />
              <input name="next" type="password" minLength={10} required className="input" placeholder="New password (at least 10 characters)" autoComplete="new-password" />
            </CredentialForm>
          </Card>
        </div>
      </div>
    </>
  );
}
