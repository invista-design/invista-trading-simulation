import { asc } from "drizzle-orm";
import { Card, Notice, PageTitle, ReasonField, sp, type SP } from "@/components/ui";
import { getDb, schema } from "@/db";
import { saveCompanyProfiles } from "@/server/admin-actions";

export const metadata = { title: "Company profiles" };

export default async function CompaniesAdmin({ searchParams }: { searchParams: SP }) {
  const q = await searchParams;
  const rows = await getDb().select().from(schema.assets).orderBy(asc(schema.assets.displayOrder));
  return (
    <>
      <PageTitle title="Company profiles" sub="Teams see this table on their Company profiles page and on each asset's page. Edit any text and save; changes show at once." />
      <Notice ok={sp(q.ok)} err={sp(q.err)} />
      <form action={saveCompanyProfiles}>
        <Card pad={false}>
          <table className="tbl tbl-stack">
            <thead>
              <tr>
                <th className="w-24">ID</th>
                <th className="w-72">Asset</th>
                <th>What it does</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} className={a.active ? "" : "opacity-60"}>
                  <td data-label="ID" className="font-semibold tracking-wide text-gold">
                    {a.code}
                    {a.active ? null : <span className="block text-xs font-normal text-muted">Hidden from teams</span>}
                  </td>
                  <td data-label="Asset">
                    <input name={`name_${a.id}`} defaultValue={a.name} required minLength={2} maxLength={80} className="input" aria-label={`${a.code} asset name`} />
                  </td>
                  <td data-label="What it does" className="stack-full">
                    <textarea name={`profile_${a.id}`} defaultValue={a.profile} rows={3} maxLength={600} className="input" aria-label={`${a.code} what it does`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <div className="card mt-4 flex flex-wrap items-end gap-2 p-4">
          <div className="min-w-64 flex-1">
            <ReasonField />
          </div>
          <button className="btn btn-primary">Save company profiles</button>
        </div>
      </form>
    </>
  );
}
