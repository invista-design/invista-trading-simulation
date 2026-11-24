/** Settings that govern 1 phase. Every field is editable in the admin panel. */
export interface PhaseRules {
  phaseNumber: number;
  allowSell: boolean;
  /** Neutral demand ratio. Workbook: 1 in Phase 1, 0 in later phases. */
  neutralRatio: string;
  newsSensitivity: string;
  demandSensitivity: string;
  /** Maximum price move in either direction, as a fraction (0.15 = 15%). */
  maxMove: string;
  /** Single-asset concentration cap as a fraction of the base value (1 = no cap). */
  capShare: string;
  rationing: boolean;
  /** Minimum number of distinct assets a team must trade in the phase (0 = no minimum). */
  minDistinctAssets: number;
}

export interface PhaseAsset {
  assetId: string;
  code: string;
  unitsPerLot: string;
  openingPricePaise: number;
  supply: number;
  newsScore: string;
}

export interface Position {
  teamId: string;
  cashPaise: number;
  /** assetId to lots held */
  lots: Record<string, number>;
}

/** assetId to signed lots: positive buys, negative sells. */
export type OrderLines = Record<string, number>;

export interface AcceptedOrder {
  teamId: string;
  lines: OrderLines;
  submittedAt?: string;
}

export interface ValidationIssue {
  assetId?: string;
  code: string;
  message: string;
}

export interface AssetResult {
  assetId: string;
  code: string;
  openingPricePaise: number;
  openingLotPricePaise: number;
  supply: number;
  buyLots: number;
  sellLots: number;
  netDemand: number;
  demandRatio: string;
  fillRatio: string;
  executedBuyLots: number;
  newsScore: string;
  newsEffect: string;
  demandEffect: string;
  combinedEffect: string;
  appliedChange: string;
  newPricePaise: number;
  newLotPricePaise: number;
  direction: "UP" | "DOWN" | "FLAT";
}

export interface TeamResult {
  teamId: string;
  hadOrder: boolean;
  orderLines: OrderLines;
  /** Signed lots that actually executed: bought (after rationing) positive, sold negative. */
  executedLines: OrderLines;
  lotsBefore: Record<string, number>;
  cashBeforePaise: number;
  openValuePaise: number;
  lotsAfter: Record<string, number>;
  cashAfterPaise: number;
  holdingsValuePaise: number;
  valuePaise: number;
  phasePnlPaise: number;
  phaseReturn: string;
  overallPnlPaise: number;
  overallReturn: string;
  /** Distinct assets with a positive executed quantity. Rationed-to-zero lines do not count. */
  tradesExecuted: number;
  meetsMinimum: boolean;
}

export interface PhaseResult {
  phaseNumber: number;
  assets: AssetResult[];
  teams: TeamResult[];
}
