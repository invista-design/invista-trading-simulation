import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Card, Empty, Notice, PageTitle, PhaseBadge, ReasonField, sp, type SP } from "@/components/ui";
import { getDb, schema } from "@/db";
import { Dec } from "@/engine";
import { dateTime } from "@/lib/format";
import { deleteAnnouncement, saveAnnouncement, saveMarketImpact } from "@/server/admin-actions";
import { getAssets, getPhases } from "@/server/core";

export const metadata = { title: "News and market impact" };

const pctOf = (v: string) => new Dec(v).mul(100).toString();

export default async function NewsAdmin({ searchParams }: { searchParams: SP }) {
  const q = await searchParams;
  const db = getDb();
  const phases = await getPhases(db);
  const tab = sp(q.tab) === "announcements" ? "announcements" : "market";
  const n = Number(sp(q.phase) ?? phases.find((p) => p.status !== "published")?.number ?? 1);
  const phase = phases.find((p) => p.number === n) ?? phases[0];
  const [assets, pa, keys, ann] = await Promise.all([
    getAssets(db),
    db.select().from(schema.phaseAssets).where(eq(schema.phaseAssets.phaseNumber, phase.number)),
    db.select().from(schema.newsKeys).where(eq(schema.newsKeys.phaseNumber, phase.number)),
    db.select().from(schema.announcements).orderBy(desc(schema.announcements.publishedAt)),
  ]);
  return (
    <>
      <PageTitle title="News and market impact" sub="Participant layer: announcements. Organiser layer (confidential): scores, real-world references and price settings. Teams never see the organiser layer." />
      <Notice ok={sp(q.ok)} err={sp(q.err)} />
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/admin/news?tab=announcements" className={`btn btn-sm ${tab === "announcements" ? "border-accent text-accent" : ""}`}>
          Announcements
        </Link>
        {phases.map((p) => (
          <Link key={p.number} href={`/admin/news?phase=${p.number}`} className={`btn btn-sm ${tab === "market" && p.number === phase.number ? "border-accent text-accent" : ""}`}>
            {p.name} scoring and market
          </Link>
        ))}
      </div>

      {tab === "announcements" ? (
        <div className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
          <Card title="New announcement">
            <form action={saveAnnouncement} className="space-y-3">
              <input name="title" required className="input" placeholder="Phase 1 news pack is live on Instagram" />
              <textarea name="body" rows={4} className="input" placeholder="Short message for teams" />
              <input name="linkUrl" className="input" placeholder="https://www.instagram.com/..." />
              <div className="flex flex-wrap gap-3">
                <select name="phase" className="input max-w-48" defaultValue="">
                  <option value="">No phase</option>
                  {phases.map((p) => (
                    <option key={p.number} value={p.number}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="visible" defaultChecked /> Visible to teams
                </label>
              </div>
              <button className="btn btn-primary">Publish announcement</button>
            </form>
          </Card>
          <Card title="Published announcements" pad={false}>
            {ann.length === 0 ? (
              <div className="p-4">
                <Empty>None yet.</Empty>
              </div>
            ) : (
              <div className="divide-y divide-line">
                {ann.map((a) => (
                  <details key={a.id} className="px-4 py-3">
                    <summary className="cursor-pointer list-none">
                      <span className="font-semibold">{a.title}</span>
                      <span className="ml-2 text-xs text-muted">
                        {dateTime(a.publishedAt)} {a.visible ? "" : "· hidden"}
                      </span>
                    </summary>
                    <form action={saveAnnouncement} className="mt-3 space-y-2">
                      <input type="hidden" name="id" value={a.id} />
                      <input name="title" defaultValue={a.title} className="input" />
                      <textarea name="body" defaultValue={a.body} rows={3} className="input" />
                      <input name="linkUrl" defaultValue={a.linkUrl} className="input" />
                      <div className="flex flex-wrap items-center gap-3">
                        <select name="phase" className="input max-w-48" defaultValue={a.phaseNumber ?? ""}>
                          <option value="">No phase</option>
                          {phases.map((p) => (
                            <option key={p.number} value={p.number}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" name="visible" defaultChecked={a.visible} /> Visible
                        </label>
                      </div>
                      <ReasonField placeholder="What was corrected (audit log)" />
                      <button className="btn btn-sm">Save correction</button>
                    </form>
                    <form action={deleteAnnouncement} className="mt-2 flex gap-2">
                      <input type="hidden" name="id" value={a.id} />
                      <input name="reason" required className="input" placeholder="Reason for deleting" />
                      <button className="btn btn-sm btn-danger">Delete</button>
                    </form>
                  </details>
                ))}
              </div>
            )}
          </Card>
        </div>
      ) : (
        <form action={saveMarketImpact} className="space-y-4">
          <input type="hidden" name="phase" value={phase.number} />
          <Card
            title={
              <span className="flex items-center gap-2">
                {phase.name} price settings <PhaseBadge status={phase.status} />
              </span>
            }
          >
            <p className="mb-3 text-sm text-muted">
              Next price = opening price times (1 + capped change). Change = news score times news sensitivity, plus (net demand divided by supply minus neutral ratio) times demand sensitivity, held within the maximum move.
              {phase.status === "confirmed" || phase.status === "published" ? " This phase is confirmed: saving marks it for recalculation, which you then preview and confirm on the Phases page." : ""}
            </p>
            <div className="grid gap-3 sm:grid-cols-4">
              <label>
                <span className="label">News sensitivity %</span>
                <input name="newsSensitivity" defaultValue={pctOf(phase.newsSensitivity)} className="input" />
              </label>
              <label>
                <span className="label">Demand sensitivity %</span>
                <input name="demandSensitivity" defaultValue={pctOf(phase.demandSensitivity)} className="input" />
              </label>
              <label>
                <span className="label">Neutral demand ratio</span>
                <input name="neutralRatio" defaultValue={phase.neutralRatio} className="input" />
              </label>
              <label>
                <span className="label">Maximum move %</span>
                <input name="maxMove" defaultValue={pctOf(phase.maxMove)} className="input" />
              </label>
            </div>
          </Card>
          <Card title="Per asset (confidential)" pad={false}>
            <div className="overflow-x-auto">
              <table className="tbl min-w-[900px]">
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>News score (minus 2 to plus 2)</th>
                    <th>Supply (lots)</th>
                    <th>Opening price override</th>
                    <th>Override value</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((a) => {
                    const r = pa.find((x) => x.assetId === a.id);
                    const k = keys.find((x) => x.assetId === a.id);
                    const ovDisplay = r?.overrideType === "price" && r.overrideValue ? String(Number(r.overrideValue) / 100) : r?.overrideValue ?? "";
                    return (
                      <tr key={a.id}>
                        <td className="font-semibold">{a.code}</td>
                        <td>
                          <input name={`score_${a.id}`} defaultValue={k?.score ?? "0"} className="input w-28" />
                        </td>
                        <td>
                          <input name={`supply_${a.id}`} defaultValue={r?.supply ?? a.baseSupply} className="input w-28" />
                        </td>
                        <td>
                          <select name={`ovType_${a.id}`} defaultValue={r?.overrideType ?? "none"} className="input w-44">
                            <option value="none">None (previous result)</option>
                            <option value="percent">Gap in % from result</option>
                            <option value="price">Fixed price in ₹</option>
                          </select>
                        </td>
                        <td>
                          <input name={`ovValue_${a.id}`} defaultValue={ovDisplay} className="input w-32" placeholder="-20 or 1500" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
          <Card title="News key (confidential)">
            <div className="space-y-2">
              {assets.map((a) => {
                const k = keys.find((x) => x.assetId === a.id);
                return (
                  <details key={a.id} className="rounded-lg border border-line px-3 py-2">
                    <summary className="cursor-pointer text-sm">
                      <span className="font-semibold">{a.code}</span> <span className="text-muted">{k?.headline || "No story recorded"}</span>
                    </summary>
                    <div className="mt-3 grid gap-2 sm:grid-cols-4">
                      <label>
                        <span className="label">Story number</span>
                        <input name={`story_${a.id}`} defaultValue={k?.storyNumber} className="input" />
                      </label>
                      <label className="sm:col-span-3">
                        <span className="label">Headline</span>
                        <input name={`headline_${a.id}`} defaultValue={k?.headline} className="input" />
                      </label>
                      <label className="sm:col-span-4">
                        <span className="label">Real-world reference</span>
                        <textarea name={`ref_${a.id}`} defaultValue={k?.realWorldReference} rows={2} className="input" />
                      </label>
                      <label className="sm:col-span-4">
                        <span className="label">Real market move</span>
                        <textarea name={`move_${a.id}`} defaultValue={k?.realMove} rows={2} className="input" />
                      </label>
                      <label className="sm:col-span-2">
                        <span className="label">Organiser explanation</span>
                        <textarea name={`expl_${a.id}`} defaultValue={k?.explanation} rows={2} className="input" />
                      </label>
                      <label className="sm:col-span-2">
                        <span className="label">Learning objective</span>
                        <textarea name={`learn_${a.id}`} defaultValue={k?.learningObjective} rows={2} className="input" />
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name={`distractor_${a.id}`} defaultChecked={k?.isDistractor} /> Distractor story
                      </label>
                    </div>
                  </details>
                );
              })}
            </div>
          </Card>
          <div className="card flex flex-wrap items-end gap-2 p-4">
            <div className="min-w-64 flex-1">
              <ReasonField />
            </div>
            <button className="btn btn-primary">Save {phase.name} settings</button>
          </div>
        </form>
      )}
    </>
  );
}

