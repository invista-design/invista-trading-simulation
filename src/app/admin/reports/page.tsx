import { Card, PageTitle } from "@/components/ui";
import { EXPORT_KINDS } from "@/server/exports";

export const metadata = { title: "Reports" };

export default function Reports() {
  return (
    <>
      <PageTitle title="Reports" sub="Download any report at any time. Excel files use Calibri and Indian digit grouping. Take a full set before and after each phase as a backup." />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Object.entries(EXPORT_KINDS).map(([kind, label]) => (
          <Card key={kind} title={label}>
            <div className="flex gap-2">
              <a className="btn btn-primary btn-sm" href={`/api/admin/export?kind=${kind}`}>
                Excel (.xlsx)
              </a>
              <a className="btn btn-sm" href={`/api/admin/export?kind=${kind}&format=csv`}>
                Comma-separated values (.csv)
              </a>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
