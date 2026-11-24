import { SEED_RULEBOOK } from "./seed-data";

/**
 * Suggested revision of the supplied rulebook so it matches the rules the platform enforces:
 * invalid orders are blocked at submission instead of leading to disqualification, and every team
 * must execute at least 3 different assets in every phase. Organisers review and publish it from the
 * Rules page; nothing changes until they do.
 */
export const RULEBOOK_CHANGES: { clause: string; from: string; to: string }[] = [
  {
    clause: "2.3",
    from: "2.3 A 10-minute countdown will start, and the order submission form will open.",
    to: "2.3 A 10-minute countdown will start, and trading will open on the competition website.",
  },
  {
    clause: "2.4",
    from: "2.4 Each team must submit its order using the designated form before the countdown ends.",
    to: "2.4 Each team must submit its order through the trading terminal on the competition website before the countdown ends.",
  },
  {
    clause: "2.5",
    from: "2.5 When the countdown ends, the form will close. The organisers will process the orders and publish the leaderboard.",
    to: "2.5 When the countdown ends, trading will close. The organisers will process the orders and publish the leaderboard.",
  },
  {
    clause: "3.2",
    from: "3.2 Orders must be submitted only through the official form for that phase. 1 team member must submit the order for the whole team.",
    to: "3.2 Orders must be submitted only through the trading terminal, using the login issued to the team. 1 order covers the whole team.",
  },
  {
    clause: "3.3",
    from: "3.3 Teams must enter a whole number of lots for each asset code. Enter 0 for any asset the team does not want to trade.",
    to: "3.3 Teams must enter a whole number of lots for each asset they trade. Leave the field blank or enter 0 for any asset the team does not want to trade.",
  },
  {
    clause: "3.4",
    from: "3.4 In Phases 2 and 3, a positive number means a purchase and a negative number means a sale. For example, 50 means buying 50 lots, while -50 means selling 50 lots.",
    to: "3.4 In Phases 2 and 3, teams choose Buy or Sell for each asset in the trading terminal and enter the number of lots.",
  },
  {
    clause: "3.5",
    from: "3.5 The total cost of purchases must not be more than the team's available cash. If an order exceeds the available cash, the team will be disqualified.",
    to: "3.5 The total cost of purchases must not be more than the team's available cash plus the proceeds of sales in the same order. The website will not accept an order that breaks this rule.",
  },
  {
    clause: "3.7",
    from: "3.7 Orders must be submitted before the countdown ends. Late orders will not be accepted.",
    to: "3.7 Orders must be submitted before the countdown ends. The website does not accept orders after that.",
  },
  {
    clause: "4.5",
    from: "4.5 A team may submit more than 1 order during a phase. Only the last order submitted before the form closes will be considered. It will replace all earlier orders for that phase.",
    to: "4.5 A team may submit more than 1 order during a phase. Only the last order accepted before the countdown ends will be considered. It will replace all earlier orders for that phase.",
  },
  {
    clause: "4.6",
    from: "4.6 A team may choose not to submit an order in Phase 2 or Phase 3. If it does not submit an order, its cash balance and asset holdings will remain unchanged.",
    to: "4.6 Every team must trade at least 3 different assets in every phase. A trade counts only when it executes with at least 1 lot. A team that ends a phase with fewer than 3 executed trades will be disqualified.",
  },
  {
    clause: "5.7",
    from: "5.7 Teams must submit orders only through the official form and before the countdown ends.",
    to: "5.7 Teams must submit orders only through the trading terminal and before the countdown ends.",
  },
  {
    clause: "6.1",
    from: "6.1 A team will be disqualified if the total cost of its purchases is more than its available cash.",
    to: "6.1 The website blocks any order that costs more than the cash available, sells more lots than the team holds, includes a sale in Phase 1 or includes a fractional lot. The team sees the reason and can correct the order before the countdown ends. A blocked order is never recorded.",
  },
  {
    clause: "6.2",
    from: "6.2 A team will be disqualified if it engages in short selling. This also includes entering a negative number in Phase 1, when selling is not allowed.",
    to: "6.2 A team will be disqualified if it does not have an accepted order that executes at least 3 different assets when a phase ends.",
  },
  {
    clause: "6.4",
    from: "6.4 If a team submits more than 1 order during a phase, only its last order submitted before the form closes will be checked. The team may correct an entry by submitting a replacement order while the form is still open.",
    to: "6.4 If a team submits more than 1 order during a phase, only its last accepted order counts. The team may correct an entry by submitting a replacement order before the countdown ends.",
  },
  {
    clause: "6.5",
    from: "6.5 Any order with another error, including a fractional lot, will be rejected in full. The following will happen if an order is rejected:\n\n6.5.1 In Phase 1, the team will keep its starting cash balance of ₹10,00,000 until Phase 2.\n\n6.5.2 In Phases 2 and 3, the team's cash balance and asset holdings will remain unchanged.",
    to: "6.5 A blocked order does not replace the team's last accepted order for that phase.",
  },
  {
    clause: "6.6",
    from: "6.6 A registered team that does not submit an order in Phase 1 will keep its starting cash balance of ₹10,00,000 until Phase 2.",
    to: "6.6 A registered team that does not submit an accepted order in a phase will be disqualified under rule 6.2.",
  },
  {
    clause: "7.1",
    from: "7.1 All trades submitted during a phase will take place at that phase's opening prices. Prices will not change while the order form is open.",
    to: "7.1 All trades submitted during a phase will take place at that phase's opening prices. Prices will not change while trading is open.",
  },
];

/** The supplied rulebook with every change applied. Clauses not found are left as they are. */
export function suggestedRulebook(base: string = SEED_RULEBOOK): { content: string; applied: string[] } {
  let content = base;
  const applied: string[] = [];
  for (const c of RULEBOOK_CHANGES) {
    if (content.includes(c.from)) {
      content = content.replace(c.from, c.to);
      applied.push(c.clause);
    }
  }
  return { content, applied };
}
