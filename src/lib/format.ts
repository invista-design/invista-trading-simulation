/** Formatting helpers safe for both server and browser. All money is in paise. */

const inr2 = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inr0 = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0, maximumFractionDigits: 0 });
const int = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

export const inr = (paise: number | null | undefined, decimals = true) =>
  paise === null || paise === undefined || Number.isNaN(paise) ? "" : (decimals ? inr2 : inr0).format(paise / 100);

export const signedInr = (paise: number) => (paise > 0 ? "+" : paise < 0 ? "-" : "") + inr(Math.abs(paise));

export const num = (n: number | null | undefined) => (n === null || n === undefined ? "" : int.format(n));

/** Fraction (0.0123) to "1.23%". */
export const pct = (fraction: string | number | null | undefined, digits = 2) => {
  if (fraction === null || fraction === undefined || fraction === "") return "";
  const v = Number(fraction) * 100;
  return `${v > 0 ? "+" : ""}${v.toFixed(digits)}%`;
};

export const plainPct = (fraction: string | number, digits = 2) => `${(Number(fraction) * 100).toFixed(digits)}%`;

export const tone = (n: number | string) => (Number(n) > 0 ? "text-up" : Number(n) < 0 ? "text-down" : "text-muted");

export const dateTime = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";

export const nameKey = (name: string) => name.replace(/\s+/g, " ").trim().toLowerCase();

/** 600 seconds to "10 minutes", 60 to "1 minute", 90 to "1 minute 30 seconds". */
export const duration = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  const mm = m ? `${m} ${m === 1 ? "minute" : "minutes"}` : "";
  const ss = s ? `${s} ${s === 1 ? "second" : "seconds"}` : "";
  return [mm, ss].filter(Boolean).join(" ") || "0 seconds";
};
