import { eq } from "drizzle-orm";
import { CredentialForm } from "@/components/credential-form";
import { Card, Notice, PageTitle, ReasonField, sp, type SP } from "@/components/ui";
import { getDb, schema } from "@/db";
import { requireOrganiser } from "@/lib/auth";
import { dateTime } from "@/lib/format";
import { addOrganiser, changeOwnPassword, resetCompetitionAction, saveSettings, setOrganiserActive } from "@/server/admin-actions";
import { resetPreview } from "@/server/reset";
import { getCompetition } from "@/server/core";

export const metadata = { title: "Settings" };

export default async function Settings({ searchParams }: { searchParams: SP }) {
  const q = await searchParams;
  const me = await requireOrganiser();
  const db = getDb();
  const [comp, organisers, counts] = await Promise.all([getCompetition(db), db.select().from(schema.users).where(eq(schema.users.role, "organiser")), resetPreview(db)]);
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
              <input name="instagramUrl" defaultValue={comp.instagramUrl} className="input" placeholder="https://www.instagram.com/your-page" />
            </label>
            <fieldset className="grid gap-3 sm:col-span-2 sm:grid-cols-3">
              <legend className="mb-1 text-sm font-semibold">Event details on the home page</legend>
              <label>
                <span className="label">Date</span>
                <input name="eventDate" defaultValue={comp.eventDate} className="input" />
              </label>
              <label>
                <span className="label">Time</span>
                <input name="eventTime" defaultValue={comp.eventTime} className="input" />
              </label>
              <label>
                <span className="label">Venue</span>
                <input name="eventVenue" defaultValue={comp.eventVenue} className="input" />
              </label>
              <label>
                <span className="label">Prize pool</span>
                <input name="prizePool" defaultValue={comp.prizePool} className="input" placeholder="Leave blank to hide" />
              </label>
              <label className="sm:col-span-2">
                <span className="label">Recommended</span>
                <input name="eventNote" defaultValue={comp.eventNote} className="input" placeholder="Leave blank to hide" />
              </label>
            </fieldset>
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

      <Card title="Reset the competition" className="mt-4 border-down/40">
        <div id="reset" className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2 text-sm">
            <p>
              Returns the competition to the state before Phase 1 opened. Every order, refused attempt and phase result is deleted, disqualifications are cleared and every phase goes back to
              Not started. Organiser accounts, the rulebook and the audit log are always kept.
            </p>
            <p className="font-medium text-down">This cannot be undone. Download the reports first if you need a copy of the current results.</p>
            <ul className="mt-2 space-y-1 text-muted">
              <li>Orders: {counts.orders}</li>
              <li>Refused attempts: {counts.attempts}</li>
              <li>Phase results: {counts.results}</li>
              <li>Phases started: {counts.phasesStarted}</li>
              <li>
                Teams: {counts.teams} ({counts.disqualified} disqualified)
              </li>
              <li>Announcements: {counts.announcements}</li>
            </ul>
            <a className="btn btn-sm mt-1" href="/admin/reports">
              Download reports
            </a>
          </div>
          <form action={resetCompetitionAction} className="space-y-3">
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="deleteTeams" className="mt-1" />
              <span>Also delete all teams and their logins. Leave unticked to keep teams and passwords for the real event.</span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="deleteAnnouncements" className="mt-1" />
              <span>Also delete all announcements</span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="restoreDefaults" className="mt-1" />
              <span>Also restore the workbook&apos;s assets, prices, supply, news scores and phase rules, undoing any edits made on those pages</span>
            </label>
            <ReasonField placeholder="Reason, for example: clear test data before the event" />
            <label className="block">
              <span className="label">Type RESET to confirm</span>
              <input name="confirm" required autoComplete="off" className="input" placeholder="RESET" />
            </label>
            <button className="btn btn-danger">Reset the competition</button>
          </form>
        </div>
      </Card>
    </>
  );
}
