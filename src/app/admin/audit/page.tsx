import { desc, ilike, or } from "drizzle-orm";
import { Card, Empty, PageTitle, sp, type SP } from "@/components/ui";
import { getDb, schema } from "@/db";
import { dateTime } from "@/lib/format";

export const metadata = { title: "Audit log" };

export default async function Audit({ searchParams }: { searchParams: SP }) {
  const q = await searchParams;
  const term = sp(q.q)?.trim() ?? "";
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.auditLog)
    .where(term ? or(ilike(schema.auditLog.action, `%${term}%`), ilike(schema.auditLog.reason, `%${term}%`), ilike(schema.auditLog.username, `%${term}%`), ilike(schema.auditLog.entityId, `%${term}%`)) : undefined)
    .orderBy(desc(schema.auditLog.id))
    .limit(500);
  return (
    <>
      <PageTitle title="Audit log" sub="Every organiser change with time, organiser, reason and the values before and after. Entries cannot be edited or deleted from the panel." />
      <form className="mb-3 flex gap-2">
        <input name="q" defaultValue={term} className="input max-w-sm" placeholder="Search action, reason, organiser or item" />
        <button className="btn">Search</button>
        <a className="btn" href="/api/admin/export?kind=audit">
          Download (.xlsx)
        </a>
      </form>
      <Card pad={false}>
        {rows.length === 0 ? (
          <div className="p-4">
            <Empty>No entries.</Empty>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {rows.map((r) => (
              <details key={r.id} className="px-4 py-2 text-sm">
                <summary className="flex cursor-pointer list-none flex-wrap gap-x-4 gap-y-1">
                  <span className="num w-44 text-muted">{dateTime(r.at)}</span>
                  <span className="w-28 font-medium">{r.username}</span>
                  <span className="w-48 font-mono text-xs text-accent">{r.action}</span>
                  <span className="text-muted">{r.entityId}</span>
                  <span className="flex-1">{r.reason}</span>
                </summary>
                {r.before || r.after ? (
                  <div className="mt-2 grid gap-2 lg:grid-cols-2">
                    {r.before ? <pre className="max-h-64 overflow-auto rounded bg-panel2 p-2 text-xs">{JSON.stringify(r.before, null, 2)}</pre> : <div />}
                    {r.after ? <pre className="max-h-64 overflow-auto rounded bg-panel2 p-2 text-xs">{JSON.stringify(r.after, null, 2)}</pre> : null}
                  </div>
                ) : null}
              </details>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
