import Decimal from "decimal.js";

/** Decimal constructor used by the engine. 40 significant digits, Excel-style rounding (half away from zero). */
export const Dec = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
export type Dec = InstanceType<typeof Dec>;

/** Excel ROUND(x, places): half away from zero. */
export function roundHalfUp(x: Decimal.Value, places = 0): Dec {
  return new Dec(x).toDecimalPlaces(places, Decimal.ROUND_HALF_UP);
}

/** Excel ROUNDDOWN(x, 0) for non-negative values. */
export function roundDown(x: Decimal.Value): Dec {
  return new Dec(x).toDecimalPlaces(0, Decimal.ROUND_DOWN);
}

/** Price per lot in paise = ROUND(price per quote unit x quote units per lot, 2 decimals of a rupee). */
export function lotPricePaise(pricePaise: number, unitsPerLot: string): number {
  return roundHalfUp(new Dec(pricePaise).mul(unitsPerLot), 0).toNumber();
}

/** Indian Rupee formatting with Indian digit grouping, for messages. */
export function formatRupees(paise: number, withPaise = true): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: withPaise ? 2 : 0,
    maximumFractionDigits: withPaise ? 2 : 0,
  }).format(rupees);
}

export function rupeesToPaise(rupees: string | number): number {
  return roundHalfUp(new Dec(rupees).mul(100), 0).toNumber();
}
