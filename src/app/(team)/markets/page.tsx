import { MarketTable } from "@/components/market-table";
import { PageTitle } from "@/components/ui";
import { requireTeam } from "@/lib/auth";
import { teamView } from "@/server/views";

export const metadata = { title: "Markets" };

export default async function Markets() {
  const user = await requireTeam();
  const v = await teamView(user.teamId);
  const cur = v.current;
  const rows = v.rows.map((r) => ({
    id: r.asset.id,
    code: r.asset.code,
    name: r.asset.name,
    sector: r.asset.sector,
    assetType: r.asset.assetType,
    quoteUnit: r.asset.quoteUnit,
    lotDefinition: r.asset.lotDefinition,
    pricePaise: r.pricePaise,
    lotPricePaise: r.lotPricePaise,
    previousPricePaise: r.previousPricePaise,
    changePaise: r.changePaise,
    changeFraction: r.changeFraction,
    held: v.holdingPosition.lots[r.asset.id] ?? 0,
  }));
  return (
    <>
      <PageTitle
        title="Markets"
        sub={
          cur?.status === "open"
            ? `${cur.name} opening prices. All orders this phase execute at these prices.`
            : "Latest public prices. Prices change only between phases."
        }
      />
      <MarketTable rows={rows} canTrade={cur?.status === "open" && v.participating} allowSell={Boolean(cur?.allowSell)} />
      <p className="mt-3 text-xs text-muted">Change compares the latest public price with the one before it. Gold is quoted per 10 grams (1 lot is 1 gram) and silver per kilogram (1 lot is 100 grams).</p>
    </>
  );
}
