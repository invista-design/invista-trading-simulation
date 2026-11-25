import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { Card, Empty, PageTitle } from "@/components/ui";
import { getDb, schema } from "@/db";
import { requireTeam } from "@/lib/auth";

export const metadata = { title: "Company profiles" };

export default async function Companies() {
  await requireTeam();
  const rows = await getDb()
    .select({ code: schema.assets.code, name: schema.assets.name, profile: schema.assets.profile })
    .from(schema.assets)
    .where(eq(schema.assets.active, true))
    .orderBy(asc(schema.assets.displayOrder));
  return (
    <>
      <PageTitle title="Company profiles" sub="What each tradable asset does. Read these alongside each news pack to judge how the news affects each company." />
      <Card pad={false}>
        {rows.length === 0 ? (
          <div className="p-4">
            <Empty>No assets yet.</Empty>
          </div>
        ) : (
          <table className="tbl tbl-stack">
            <thead>
              <tr>
                <th className="w-28">ID</th>
                <th className="w-64">Asset</th>
                <th>What it does</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.code}>
                  <td data-label="ID" className="font-semibold tracking-wide text-gold">
                    {r.code}
                  </td>
                  <td data-label="Asset" className="font-medium">
                    <Link href={`/markets/${r.code}`} className="hover:text-accent hover:underline">
                      {r.name}
                    </Link>
                  </td>
                  <td data-label="What it does" className="stack-full leading-relaxed">
                    {r.profile || <span className="text-muted">Profile coming soon.</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
