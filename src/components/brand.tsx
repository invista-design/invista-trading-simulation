import Link from "next/link";
import { splitTitle } from "@/lib/format";

export const CLUB_NAME = "InVista - The Investment Club";
export const INSTITUTE = "International Management Institute (IMI), Delhi";
const ALT = `${CLUB_NAME}, ${INSTITUTE}`;

/** The InVista seal. The small file is used up to 160 pixels, the large one above that. */
export function Logo({ size = 40, className = "" }: { size?: number; className?: string }) {
  return <img src={size > 160 ? "/invista-logo.webp" : "/invista-logo-160.webp"} width={size} height={size} alt={ALT} className={`shrink-0 ${className}`} />;
}

/** Logo with the competition name split into its title and subtitle. */
export function Brand({ name, href = "/", size = 44, sub, compact = false }: { name: string; href?: string; size?: number; sub?: React.ReactNode; compact?: boolean }) {
  const [title, subtitle] = splitTitle(name);
  return (
    <Link href={href} className="flex items-center gap-3">
      <Logo size={size} />
      <span className="min-w-0 leading-tight">
        <span className={`display block font-bold text-gold ${compact ? "text-[0.95rem]" : "text-lg"}`}>{title}</span>
        <span className="block text-xs text-muted">{sub ?? subtitle}</span>
      </span>
    </Link>
  );
}

/** Slow ticker of the tradable assets: codes and names only, never prices. */
export function AssetTicker({ assets }: { assets: { code: string; name: string }[] }) {
  if (!assets.length) return null;
  const items = [...assets, ...assets];
  return (
    <div className="overflow-hidden border-y border-line bg-panel/60" aria-label="Assets you will trade">
      <div className="ticker-track flex w-max gap-10 py-3 pr-10">
        {items.map((a, i) => (
          <span key={i} className="flex items-baseline gap-2 whitespace-nowrap text-sm" aria-hidden={i >= assets.length ? true : undefined}>
            <span className="font-semibold tracking-wide text-gold">{a.code}</span>
            <span className="text-muted">{a.name}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Club and institute, on 2 lines, for the public page headers. */
export function ClubLines() {
  return (
    <>
      <span className="block">{CLUB_NAME}</span>
      <span className="block">{INSTITUTE}</span>
    </>
  );
}
