import { Suspense } from "react";
import { Terminal } from "@/components/terminal";
import { PageTitle } from "@/components/ui";
import { requireTeam } from "@/lib/auth";
import { teamView } from "@/server/views";
import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";

export const metadata = { title: "Trade" };

export default async function Trade() {
  const user = await requireTeam();
  const v = await teamView(user.teamId);
  const cur = v.current;
  const [phaseRow] = cur ? await getDb().select({ capShare: schema.phases.capShare }).from(schema.phases).where(eq(schema.phases.number, cur.number)).limit(1) : [];
  // The phase teams trade in: the open one, else the next one to open (planning mode).
  const tradable = cur && (cur.status === "open" || cur.status === "paused" || cur.status === "draft") ? cur : null;
  const assets = v.rows.map((r) => {
    const open = tradable && r.currentOpeningPaise != null ? r.currentOpeningPaise : r.pricePaise;
    const lot = tradable && r.currentOpeningLotPaise != null ? r.currentOpeningLotPaise : r.lotPricePaise;
    return {
      id: r.asset.id,
      code: r.asset.code,
      name: r.asset.name,
      lotDefinition: r.asset.lotDefinition,
      quoteUnit: r.asset.quoteUnit,
      unitsPerLot: r.asset.unitsPerLot,
      openingPricePaise: open,
      lotPricePaise: lot,
    };
  });
  let blocked: string | null = null;
  if (!v.participating) blocked = "Your team is disqualified and cannot trade.";
  else if (!tradable) blocked = "There is no phase open for trading right now. Results are being processed.";
  else if (tradable.status === "draft") blocked = `${tradable.name} has not opened yet. You can plan your order now using the latest prices; opening prices are confirmed when the phase opens.`;
  else if (tradable.status === "paused") blocked = "Trading is paused by the organisers. Your accepted order stays on file.";
  const position = tradable ? v.position : v.holdingPosition;
  return (
    <>
      <PageTitle title="Trading terminal" sub="Enter lots for each asset, check the summary, review and submit. Every rule is checked as you type and again on the server." />
      <Suspense>
        <Terminal
          key={`${tradable?.number ?? 0}-${tradable?.status ?? "none"}`}
          teamId={user.teamId}
          phase={{
            number: tradable?.number ?? cur?.number ?? 1,
            name: tradable?.name ?? cur?.name ?? "Phase",
            status: tradable?.status ?? "closed",
            allowSell: tradable?.allowSell ?? false,
            minDistinctAssets: tradable?.minDistinctAssets ?? 0,
            capShare: phaseRow?.capShare ?? "1",
          }}
          canSubmit={Boolean(tradable && tradable.status === "open" && v.participating)}
          blockedReason={blocked}
          assets={assets}
          cashPaise={position.cashPaise}
          lots={position.lots}
          capitalPaise={v.comp.startingCapitalPaise}
          liveOrder={v.liveOrder ? { lines: v.liveOrder.lines, submittedAt: v.liveOrder.submittedAt.toISOString() } : null}
        />
      </Suspense>
    </>
  );
}
