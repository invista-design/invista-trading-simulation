import { Card, Empty, PageTitle } from "@/components/ui";
import { requireTeam } from "@/lib/auth";
import { dateTime } from "@/lib/format";
import { getDb } from "@/db";
import { getCompetition } from "@/server/core";
import { publicAnnouncements } from "@/server/views";

export const metadata = { title: "News" };

export default async function News() {
  await requireTeam();
  const [ann, comp] = await Promise.all([publicAnnouncements(), getCompetition(getDb())]);
  return (
    <>
      <PageTitle
        title="News and announcements"
        sub={
          <>
            News packs are released on the {comp.organiser} Instagram page.
            {comp.instagramUrl ? (
              <>
                {" "}
                <a className="text-accent underline" href={comp.instagramUrl} target="_blank" rel="noreferrer">
                  Open Instagram
                </a>
              </>
            ) : null}{" "}
            Read the news, judge its effect yourself, then trade.
          </>
        }
      />
      {ann.length === 0 ? (
        <Empty>No announcements yet. They appear here as soon as the organisers post them.</Empty>
      ) : (
        <div className="space-y-3">
          {ann.map((a) => {
            const edited = a.updatedAt.getTime() - a.publishedAt.getTime() > 1000;
            return (
              <Card key={a.id}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-base font-semibold">{a.title}</h2>
                  <span className="text-xs text-muted">
                    {a.phaseNumber ? `Phase ${a.phaseNumber} · ` : ""}
                    {dateTime(a.publishedAt)}
                    {edited ? ` · updated ${dateTime(a.updatedAt)}` : ""}
                  </span>
                </div>
                {a.body ? <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{a.body}</p> : null}
                {a.linkUrl ? (
                  <a className="btn btn-sm mt-3" href={a.linkUrl} target="_blank" rel="noreferrer">
                    Open the news pack
                  </a>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
