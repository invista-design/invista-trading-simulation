import { Card, Notice, PageTitle, ReasonField, sp, type SP } from "@/components/ui";
import { getDb, schema } from "@/db";
import { lotPricePaise, suggestedSupply } from "@/engine";
import { inr, num } from "@/lib/format";
import { recalibrateSupply, removeAsset, saveAsset } from "@/server/admin-actions";
import { getAssets, getCompetition, getPhases } from "@/server/core";
import type { Asset } from "@/server/core";

export const metadata = { title: "Assets and companies" };

function AssetForm({ a, locked }: { a?: Asset; locked: boolean }) {
  return (
    <form action={saveAsset} className="grid gap-2 sm:grid-cols-4">
      {a ? <input type="hidden" name="assetId" value={a.id} /> : null}
      <label>
        <span className="label">Code</span>
        <input name="code" defaultValue={a?.code} required className="input font-mono" readOnly={locked && Boolean(a)} />
      </label>
      <label className="sm:col-span-2">
        <span className="label">Name</span>
        <input name="name" defaultValue={a?.name} required className="input" />
      </label>
      <label>
        <span className="label">Type</span>
        <select name="assetType" defaultValue={a?.assetType ?? "Stock"} className="input">
          <option>Stock</option>
          <option>Commodity</option>
        </select>
      </label>
      <label>
        <span className="label">Sector</span>
        <input name="sector" defaultValue={a?.sector} className="input" />
      </label>
      <label>
        <span className="label">Price quoted</span>
        <input name="quoteUnit" defaultValue={a?.quoteUnit ?? "per share"} className="input" />
      </label>
      <label>
        <span className="label">Lot definition</span>
        <input name="lotDefinition" defaultValue={a?.lotDefinition ?? "1 lot = 1 share"} className="input" />
      </label>
      <label>
        <span className="label">Quote units per lot</span>
        <input name="unitsPerLot" defaultValue={a?.unitsPerLot ?? "1"} className="input" readOnly={locked && Boolean(a)} />
      </label>
      <label>
        <span className="label">Initial price (₹ per quote unit)</span>
        <input name="initialPrice" defaultValue={a ? a.initialPricePaise / 100 : ""} required className="input" readOnly={locked && Boolean(a)} />
      </label>
      <label>
        <span className="label">Base supply (lots)</span>
        <input name="baseSupply" defaultValue={a?.baseSupply ?? 0} className="input" />
      </label>
      <label>
        <span className="label">Display order</span>
        <input name="displayOrder" defaultValue={a?.displayOrder ?? 99} className="input" />
      </label>
      <label className="sm:col-span-4">
        <span className="label">Company profile (shown to teams)</span>
        <textarea name="profile" defaultValue={a?.profile} rows={3} className="input" placeholder="Overview, business profile and revenue exposure, as written in your news materials" />
      </label>
      <label className="sm:col-span-4">
        <span className="label">Additional description (shown to teams)</span>
        <textarea name="description" defaultValue={a?.description} rows={2} className="input" />
      </label>
      <div className="sm:col-span-3">
        <ReasonField />
      </div>
      <button className="btn btn-primary">{a ? "Save asset" : "Add asset"}</button>
    </form>
  );
}

export default async function AssetsPage({ searchParams }: { searchParams: SP }) {
  const q = await searchParams;
  const db = getDb();
  const [comp, assets, phases, teams] = await Promise.all([getCompetition(db), getAssets(db, true), getPhases(db), db.select({ id: schema.teams.id }).from(schema.teams)]);
  const locked = phases.some((p) => p.status !== "draft");
  const n = teams.length || comp.supplyCalibratedFor;
  return (
    <>
      <PageTitle title="Assets and companies" sub={locked ? "Phase 1 has opened: codes, lot sizes and initial prices are locked. Names, profiles and descriptions stay editable." : "Everything here is editable until Phase 1 opens."} />
      <Notice ok={sp(q.ok)} err={sp(q.err)} />
      <Card title="Supply calibration" className="mb-4">
        <p className="mb-3 text-sm text-muted">
          Workbook formula: supply = teams times starting capital times deployment share, divided by the number of assets, divided by the price per lot. Currently calibrated for {comp.supplyCalibratedFor} teams at {(Number(comp.deploymentShare) * 100).toFixed(0)}% deployment. Applies to every phase not yet confirmed.
        </p>
        <form action={recalibrateSupply} className="grid gap-2 sm:grid-cols-4">
          <label>
            <span className="label">Number of teams</span>
            <input name="teams" defaultValue={n} className="input" />
          </label>
          <label>
            <span className="label">Deployment share in %</span>
            <input name="deployment" defaultValue={(Number(comp.deploymentShare) * 100).toFixed(0)} className="input" />
          </label>
          <div className="sm:col-span-2 sm:self-end">
            <ReasonField />
          </div>
          <button className="btn btn-primary sm:col-start-4">Recalibrate supply</button>
        </form>
        <div className="mt-3 overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Asset</th>
                <th className="text-right">Price per lot</th>
                <th className="text-right">Current supply</th>
                <th className="text-right">Suggested for {n} teams</th>
              </tr>
            </thead>
            <tbody>
              {assets.filter((a) => a.active).map((a) => {
                const lp = lotPricePaise(a.initialPricePaise, a.unitsPerLot);
                return (
                  <tr key={a.id}>
                    <td className="font-semibold">{a.code}</td>
                    <td className="num text-right">{inr(lp)}</td>
                    <td className="num text-right">{num(a.baseSupply)}</td>
                    <td className="num text-right">{num(suggestedSupply(n, comp.startingCapitalPaise, comp.deploymentShare, assets.filter((x) => x.active).length, lp))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="space-y-3">
        {assets.map((a) => (
          <details key={a.id} className="card px-4 py-3">
            <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
              <span>
                <span className="font-semibold">{a.code}</span> <span className="text-muted">{a.name}</span>
              </span>
              <span className="num text-sm text-muted">
                {inr(a.initialPricePaise)} {a.quoteUnit} · {a.lotDefinition}
              </span>
            </summary>
            <div className="mt-3">
              <AssetForm a={a} locked={locked} />
              {!locked ? (
                <form action={removeAsset} className="mt-3 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="assetId" value={a.id} />
                  <div className="min-w-56 flex-1">
                    <ReasonField placeholder="Reason for removing this asset" />
                  </div>
                  <button className="btn btn-danger btn-sm">Remove asset</button>
                </form>
              ) : null}
            </div>
          </details>
        ))}
      </div>
      {!locked ? (
        <Card title="Add an asset" className="mt-4">
          <AssetForm locked={false} />
        </Card>
      ) : null}
    </>
  );
}
