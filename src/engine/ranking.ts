export interface RankInput {
  teamId: string;
  name: string;
  valuePaise: number;
  /** Value after the previous phase. Rulebook 7.6 first tie-break. Null in Phase 1. */
  previousValuePaise: number | null;
  /** Time of the team's last accepted order in this phase. Earlier wins (rulebook 7.6 second tie-break). */
  lastOrderAt: string | null;
}

export interface Ranked extends RankInput {
  rank: number;
}

function compare(a: RankInput, b: RankInput): number {
  if (a.valuePaise !== b.valuePaise) return b.valuePaise - a.valuePaise;
  const pa = a.previousValuePaise ?? 0;
  const pb = b.previousValuePaise ?? 0;
  if (pa !== pb) return pb - pa;
  if (a.lastOrderAt !== b.lastOrderAt) {
    if (a.lastOrderAt === null) return 1;
    if (b.lastOrderAt === null) return -1;
    return a.lastOrderAt < b.lastOrderAt ? -1 : 1;
  }
  return 0;
}

/** Highest value first. Ties follow rulebook 7.6; teams equal on every criterion share a rank. */
export function rankTeams(rows: RankInput[]): Ranked[] {
  const sorted = [...rows].sort((a, b) => compare(a, b) || a.name.localeCompare(b.name));
  const out: Ranked[] = [];
  sorted.forEach((r, i) => {
    const prev = out[i - 1];
    const rank = prev && compare(prev, r) === 0 ? prev.rank : i + 1;
    out.push({ ...r, rank });
  });
  return out;
}
