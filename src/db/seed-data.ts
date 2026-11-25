// Generated from Trading_Simulation_Model_Rounds_1-3.xlsx and the participant rulebook. Loaded once at first setup;
// every value is editable afterwards in the admin panel.

export const SEED_ASSETS = [
  {
    "code": "VRDB",
    "profile": "Private sector bank. Large in vehicle loans and loans to small businesses.",
    "name": "Vardhan Bank Limited",
    "assetType": "Stock",
    "sector": "Banking",
    "quoteUnit": "per share",
    "lotDefinition": "1 lot = 1 share",
    "unitsPerLot": "1",
    "initialPricePaise": 164200,
    "baseSupply": 639,
    "displayOrder": 1
  },
  {
    "code": "ORBT",
    "profile": "Information technology services. Most revenue comes from clients in the United States, many of them banks and insurers. Many of its engineers work in the United States on work visas.",
    "name": "Orbit Infotech Limited",
    "assetType": "Stock",
    "sector": "Information technology",
    "quoteUnit": "per share",
    "lotDefinition": "1 lot = 1 share",
    "unitsPerLot": "1",
    "initialPricePaise": 138500,
    "baseSupply": 758,
    "displayOrder": 2
  },
  {
    "code": "AROG",
    "profile": "Makes generic (unbranded) medicines. Close to half of its sales come from the United States. Plants at Baddi (tablets) and Dahej (injections).",
    "name": "Arogya Pharma Limited",
    "assetType": "Stock",
    "sector": "Pharmaceuticals",
    "quoteUnit": "per share",
    "lotDefinition": "1 lot = 1 share",
    "unitsPerLot": "1",
    "initialPricePaise": 97800,
    "baseSupply": 1074,
    "displayOrder": 3
  },
  {
    "code": "SNFD",
    "profile": "Packaged foods, noodles and snacks. A Swiss parent company owns a majority stake and licenses its brands to Sunfield.",
    "name": "Sunfield Consumer Limited",
    "assetType": "Stock",
    "sector": "Consumer goods",
    "quoteUnit": "per share",
    "lotDefinition": "1 lot = 1 share",
    "unitsPerLot": "1",
    "initialPricePaise": 241500,
    "baseSupply": 435,
    "displayOrder": 4
  },
  {
    "code": "VLCM",
    "profile": "India's largest maker of small cars. Also owns a luxury car brand based in the United Kingdom that sells a large share of its cars in the United States.",
    "name": "Veloce Motors Limited",
    "assetType": "Stock",
    "sector": "Automobiles",
    "quoteUnit": "per share",
    "lotDefinition": "1 lot = 1 share",
    "unitsPerLot": "1",
    "initialPricePaise": 76400,
    "baseSupply": 1374,
    "displayOrder": 5
  },
  {
    "code": "KNRK",
    "profile": "Steel maker. Sells most of its steel in India and competes with imports, mainly from China.",
    "name": "Konark Steel Limited",
    "assetType": "Stock",
    "sector": "Steel",
    "quoteUnit": "per share",
    "lotDefinition": "1 lot = 1 share",
    "unitsPerLot": "1",
    "initialPricePaise": 31200,
    "baseSupply": 3365,
    "displayOrder": 6
  },
  {
    "code": "TRNG",
    "profile": "India's second largest mobile operator. Financially strong, with low debt compared with its rivals.",
    "name": "Tarang Telecom Limited",
    "assetType": "Stock",
    "sector": "Telecommunications",
    "quoteUnit": "per share",
    "lotDefinition": "1 lot = 1 share",
    "unitsPerLot": "1",
    "initialPricePaise": 18600,
    "baseSupply": 5645,
    "displayOrder": 7
  },
  {
    "code": "HLGP",
    "profile": "Builds and runs solar and wind farms in India. Sells power under 25-year contracts.",
    "name": "Helios Green Power Limited",
    "assetType": "Stock",
    "sector": "Renewable energy",
    "quoteUnit": "per share",
    "lotDefinition": "1 lot = 1 share",
    "unitsPerLot": "1",
    "initialPricePaise": 52800,
    "baseSupply": 1989,
    "displayOrder": 8
  },
  {
    "code": "GOLD",
    "profile": "Priced at the Indian bullion rate, which includes import duty.",
    "name": "Gold",
    "assetType": "Commodity",
    "sector": "Precious metals",
    "quoteUnit": "per 10 grams",
    "lotDefinition": "1 lot = 1 gram",
    "unitsPerLot": "0.1",
    "initialPricePaise": 14317000,
    "baseSupply": 73,
    "displayOrder": 9
  },
  {
    "code": "SILVER",
    "profile": "Priced at the Indian bullion rate, which includes import duty. Used in jewellery, solar panels and electronics.",
    "name": "Silver",
    "assetType": "Commodity",
    "sector": "Precious metals",
    "quoteUnit": "per kilogram",
    "lotDefinition": "1 lot = 100 grams",
    "unitsPerLot": "0.1",
    "initialPricePaise": 18728000,
    "baseSupply": 56,
    "displayOrder": 10
  }
] as const;

/** Confidential: news score and real-world reference per phase and asset (Setup columns L and N). */
export const SEED_NEWS_KEYS: Record<number, Record<string, { score: string; storyNumber: string; headline: string; realWorldReference: string; realMove: string; explanation: string }>> = {
  "1": {
    "VRDB": {
      "storyNumber": "2",
      "headline": "Regulator approves reappointment of Vardhan Bank's chief executive, but only for 1 year.",
      "realWorldReference": "IndusInd Bank, March 2025. The Reserve Bank of India approved chief executive Sumant Kathpalia's reappointment for 1 year instead of the 3 years the board wanted.",
      "realMove": "IndusInd Bank closed 3.86% lower at ₹900.60 on the Bombay Stock Exchange on 10 March 2025, after touching a 52-week low of ₹881.10 on the National Stock Exchange during the day.",
      "explanation": "",
      "score": "-0.26"
    },
    "ORBT": {
      "storyNumber": "1",
      "headline": "Orbit Infotech raises its revenue forecast for the year.",
      "realWorldReference": "Infosys, results for the October to December 2024 quarter, announced on 16 January 2025.",
      "realMove": "Infosys raised its forecast from 3.75% to 4.5% up to 4.5% to 5%, yet its shares fell as much as 5.73% to ₹1,815.70 on the Bombay Stock Exchange on 17 January 2025. Large deal wins were weak and the forecast implied a revenue decline in the next quarter.",
      "explanation": "",
      "score": "-0.38"
    },
    "AROG": {
      "storyNumber": "7",
      "headline": "Arogya Pharma receives Establishment Inspection Report for its Baddi plant.",
      "realWorldReference": "Gland Pharma received an Establishment Inspection Report for its Dundigal facility in Hyderabad on 16 January 2025, after an inspection in July 2024.",
      "realMove": "Gland Pharma rose as much as 2.76% to ₹1,719 on the Bombay Stock Exchange on 16 January 2025. By 2:14 pm the gain had shrunk to 0.78% at ₹1,685.80.",
      "explanation": "",
      "score": "0.05"
    },
    "SNFD": {
      "storyNumber": "5",
      "headline": "Sunfield board approves higher royalty to its Swiss parent.",
      "realWorldReference": "Nestle India, March 2013. The board approved raising the royalty to Nestle SA from 3.5% to 4.5% of sales, at 0.2% a year from 1 January 2014.",
      "realMove": "Nestle India traded 2% lower at ₹4,612 on the Bombay Stock Exchange on 25 March 2013.",
      "explanation": "",
      "score": "-0.13"
    },
    "VLCM": {
      "storyNumber": "10",
      "headline": "Veloce Motors recalls 87,599 cars to replace a steering part.",
      "realWorldReference": "Maruti Suzuki recalled 87,599 S-Presso and Eeco cars for a possible steering tie rod defect on 24 July 2023.",
      "realMove": "Maruti Suzuki dipped only 0.15% to ₹9,680 in early trading on 25 July 2023.",
      "explanation": "",
      "score": "-0.01"
    },
    "KNRK": {
      "storyNumber": "3",
      "headline": "Trade regulator recommends a 12% duty on some steel imports.",
      "realWorldReference": "Recommendation of a 12% provisional safeguard duty on steel imports, 18 March 2025.",
      "realMove": "On 19 March 2025, Tata Steel rose 2.97% to ₹159.25 and Steel Authority of India rose 5.05% to ₹114.40 during the day on the Bombay Stock Exchange. The exchange's metal index rose 500 points to 31,091.",
      "explanation": "",
      "score": "0.2"
    },
    "TRNG": {
      "storyNumber": "9",
      "headline": "Foreign partner sells 1.2% of Tarang Telecom in a single large deal.",
      "realWorldReference": "Singtel sold 1.2% of Bharti Airtel in a block deal at ₹1,814 a share on 16 May 2025.",
      "realMove": "Bharti Airtel fell 2.65% to ₹1,817.30 on 16 May 2025. The block deal price was 2.83% below the previous close.",
      "explanation": "",
      "score": "-0.18"
    },
    "HLGP": {
      "storyNumber": "6",
      "headline": "Founder of a large renewable energy group charged with bribery in a United States court.",
      "realWorldReference": "United States charges against Gautam Adani and others, made public on 21 November 2024.",
      "realMove": "Adani Green Energy fell 14.52% during the afternoon of 21 November 2024. Other power companies with no link to the case also fell, and by 1:41 pm the Bombay Stock Exchange utilities index was down 2.8%.",
      "explanation": "",
      "score": "-0.19"
    },
    "GOLD": {
      "storyNumber": "4",
      "headline": "United States central bank cuts interest rates by 0.25%, but signals fewer cuts ahead.",
      "realWorldReference": "United States Federal Reserve decision of 18 December 2024.",
      "realMove": "By midday on 19 December 2024, gold had fallen $46.30 to $2,607.00 an ounce (1.7%) and silver had fallen $1.48 to $29.26 an ounce (4.8%).",
      "explanation": "",
      "score": "-0.12"
    },
    "SILVER": {
      "storyNumber": "4",
      "headline": "United States central bank cuts interest rates by 0.25%, but signals fewer cuts ahead.",
      "realWorldReference": "United States Federal Reserve decision of 18 December 2024.",
      "realMove": "By midday on 19 December 2024, gold had fallen $46.30 to $2,607.00 an ounce (1.7%) and silver had fallen $1.48 to $29.26 an ounce (4.8%).",
      "explanation": "",
      "score": "-0.32"
    }
  },
  "2": {
    "VRDB": {
      "storyNumber": "2",
      "headline": "Vardhan Bank finds accounting gaps in its hedging book.",
      "realWorldReference": "IndusInd Bank disclosed accounting discrepancies in its derivatives portfolio on the evening of 10 March 2025.",
      "realMove": "IndusInd Bank fell 27.06% to ₹656.80 on 11 March 2025, wiping out more than ₹19,500 crore of market value. The estimated hit was 2.35% of net worth.",
      "explanation": "column P opens this share 20% below its Round 1 closing price (black swan gap). Gap of 20% plus news effect of -8.85% gives a total fall of 27.1%, matching the real 27.06% fall.",
      "score": "-0.59"
    },
    "ORBT": {
      "storyNumber": "8",
      "headline": "United States to charge a $100,000 fee on new H-1B work visas.",
      "realWorldReference": "United States H-1B visa fee announced on 19 September 2025.",
      "realMove": "On 22 September 2025, Infosys closed 2.6% lower and the Nifty Information Technology index fell 2.95%, wiping ₹85,496 crore off information technology stocks.",
      "explanation": "",
      "score": "-0.17"
    },
    "AROG": {
      "storyNumber": "5",
      "headline": "United States announces 100% tariff on imported branded and patented medicines.",
      "realWorldReference": "United States tariff on branded and patented drugs announced on 25 September 2025.",
      "realMove": "The Nifty Pharma index closed 2.14% lower on 26 September 2025.",
      "explanation": "",
      "score": "-0.14"
    },
    "SNFD": {
      "storyNumber": "1",
      "headline": "Prime Minister announces next-generation Goods and Services Tax reform.",
      "realWorldReference": "Goods and Services Tax reform announced on 15 August 2025.",
      "realMove": "On 18 August 2025, the first trading day after the speech, Maruti Suzuki closed 8.92% higher and Nestle India closed 5.23% higher on the National Stock Exchange.",
      "explanation": "",
      "score": "0.35"
    },
    "VLCM": {
      "storyNumber": "1",
      "headline": "Prime Minister announces next-generation Goods and Services Tax reform.",
      "realWorldReference": "Goods and Services Tax reform announced on 15 August 2025.",
      "realMove": "On 18 August 2025, the first trading day after the speech, Maruti Suzuki closed 8.92% higher and Nestle India closed 5.23% higher on the National Stock Exchange.",
      "explanation": "",
      "score": "0.59"
    },
    "KNRK": {
      "storyNumber": "7",
      "headline": "China's central bank cuts interest rates and announces support for the property market.",
      "realWorldReference": "People's Bank of China stimulus announced on 24 September 2024.",
      "realMove": "On 24 September 2024, Tata Steel rose 4.29% and the Bombay Stock Exchange metal index rose 2.78% to 33,074.84.",
      "explanation": "",
      "score": "0.29"
    },
    "TRNG": {
      "storyNumber": "6",
      "headline": "Supreme Court rejects telecom companies' plea to recalculate past licence dues.",
      "realWorldReference": "Supreme Court dismissal of curative petitions on adjusted gross revenue dues, published 19 September 2024.",
      "realMove": "On 19 September 2024, Vodafone Idea closed 19.7% lower at ₹10.44, while Bharti Airtel closed 1% higher at ₹1,672.",
      "explanation": "",
      "score": "0.07"
    },
    "HLGP": {
      "storyNumber": "4",
      "headline": "Government unveils 10-year clean energy plan with tax credits for solar and wind.",
      "realWorldReference": "The United States Inflation Reduction Act deal between Senators Schumer and Manchin, announced on 27 July 2022, with $369 billion for clean energy and the 30% solar tax credit extended to 2032.",
      "realMove": "On 28 July 2022, First Solar rose 15.3% and SunPower 18.2%.",
      "explanation": "",
      "score": "1.02"
    },
    "GOLD": {
      "storyNumber": "3",
      "headline": "Large United States bank collapses after depositors withdraw $42 billion in 1 day.",
      "realWorldReference": "Silicon Valley Bank collapse, 10 March 2023, and the market reaction on 13 March 2023.",
      "realMove": "On 13 March 2023, gold futures settled 2.6% higher at $1,916.50 an ounce and silver rose 6.3% to $21.81 an ounce. In India, the Nifty Bank index fell 2.3% that day.",
      "explanation": "",
      "score": "0.17"
    },
    "SILVER": {
      "storyNumber": "3",
      "headline": "Large United States bank collapses after depositors withdraw $42 billion in 1 day.",
      "realWorldReference": "Silicon Valley Bank collapse, 10 March 2023, and the market reaction on 13 March 2023.",
      "realMove": "On 13 March 2023, gold futures settled 2.6% higher at $1,916.50 an ounce and silver rose 6.3% to $21.81 an ounce. In India, the Nifty Bank index fell 2.3% that day.",
      "explanation": "",
      "score": "0.42"
    }
  },
  "3": {
    "VRDB": {
      "storyNumber": "2",
      "headline": "Reserve Bank of India says Vardhan Bank is well capitalised.",
      "realWorldReference": "Reserve Bank of India statement on IndusInd Bank, 15 March 2025.",
      "realMove": "IndusInd Bank rose as much as 5.58% to ₹709.90 on 17 March 2025, but closed only 0.72% higher at ₹676.95 on the Bombay Stock Exchange.",
      "explanation": "",
      "score": "0.05"
    },
    "ORBT": {
      "storyNumber": "5",
      "headline": "Orbit Infotech announces its largest ever share buyback.",
      "realWorldReference": "Infosys buyback approved on 11 September 2025: ₹18,000 crore at ₹1,800 a share, 19.24% above the previous close.",
      "realMove": "Infosys rose 2.33% to a high of ₹1,544.65 on 12 September 2025.",
      "explanation": "",
      "score": "0.16"
    },
    "AROG": {
      "storyNumber": "7",
      "headline": "Arogya Pharma's Dahej plant classified as Official Action Indicated.",
      "realWorldReference": "Sun Pharma's Baska facility classified Official Action Indicated, disclosed on 18 December 2025.",
      "realMove": "Sun Pharma fell as much as 2.6% to ₹1,746.10 and traded 2.1% lower at ₹1,754 at 10:25 am on 18 December 2025.",
      "explanation": "",
      "score": "-0.14"
    },
    "SNFD": {
      "storyNumber": "9",
      "headline": "Sunfield Consumer to buy 2 brands for ₹7,000 crore.",
      "realWorldReference": "Tata Consumer Products agreed to buy Capital Foods (Ching's Secret) and Organic India on 12 January 2024.",
      "realMove": "Tata Consumer Products traded 0.65% lower at ₹1,151 at 3 pm on 15 January 2024, the first trading day after the deals.",
      "explanation": "",
      "score": "-0.04"
    },
    "VLCM": {
      "storyNumber": "3",
      "headline": "United States announces 25% tariff on all imported cars.",
      "realWorldReference": "United States tariff on imported cars announced on 26 March 2025.",
      "realMove": "Tata Motors, owner of Jaguar Land Rover, closed 5.63% lower at ₹668.40 on 27 March 2025. The Nifty Auto index fell 1.6%.",
      "explanation": "",
      "score": "-0.38"
    },
    "KNRK": {
      "storyNumber": "6",
      "headline": "United States doubles tariff on steel and aluminium imports to 50%.",
      "realWorldReference": "United States steel and aluminium tariff increase announced on 30 May 2025.",
      "realMove": "On 2 June 2025, the Nifty Metal index fell as much as 1.6% to 9,047.95. A brokerage quoted in the report said the impact on large Indian steel makers should be very limited because they export little steel to the United States.",
      "explanation": "",
      "score": "-0.11"
    },
    "TRNG": {
      "storyNumber": "8",
      "headline": "Mobile operators raise tariffs by up to 25%.",
      "realWorldReference": "Reliance Jio and Bharti Airtel tariff increases announced on 27 and 28 June 2024.",
      "realMove": "Bharti Airtel rose as much as 5% to a record ₹1,539.10 on 28 June 2024, but later traded 1% higher at ₹1,487. It had already risen 3.33% on 26 June as investors expected the increase.",
      "explanation": "",
      "score": "0.07"
    },
    "HLGP": {
      "storyNumber": "4",
      "headline": "Helios Green Power launches ₹2,000 crore share sale to large investors.",
      "realWorldReference": "Suzlon Energy launched a ₹2,000 crore qualified institutional placement on 9 August 2023, with a floor price of ₹18.44.",
      "realMove": "Suzlon Energy rose as much as 5% and traded 4.87% higher at ₹20.45 on the National Stock Exchange on 10 August 2023. The floor price was 5.4% below the previous close of ₹19.50.",
      "explanation": "",
      "score": "0.32"
    },
    "GOLD": {
      "storyNumber": "1",
      "headline": "Government cuts customs duty on gold and silver to 6% from 15%.",
      "realWorldReference": "Union Budget, 23 July 2024.",
      "realMove": "In the Delhi market on 23 July 2024, gold fell ₹3,350 to ₹72,300 per 10 grams (4.43%) and silver fell ₹3,500 to ₹87,500 per kilogram (3.85%).",
      "explanation": "",
      "score": "-0.3"
    },
    "SILVER": {
      "storyNumber": "1",
      "headline": "Government cuts customs duty on gold and silver to 6% from 15%.",
      "realWorldReference": "Union Budget, 23 July 2024.",
      "realMove": "In the Delhi market on 23 July 2024, gold fell ₹3,350 to ₹72,300 per 10 grams (4.43%) and silver fell ₹3,500 to ₹87,500 per kilogram (3.85%).",
      "explanation": "",
      "score": "-0.26"
    }
  }
};

/** Phase 2 opens Vardhan Bank 20% below its Phase 1 result (R2 Setup cell P17). */
export const SEED_OVERRIDES: { phase: number; code: string; type: "percent" | "price"; value: string }[] = [{ phase: 2, code: "VRDB", type: "percent", value: "-20" }];

export const SEED_RULEBOOK = "**TRADING SIMULATION**\n\n**PARTICIPANT RULEBOOK**\n\nThe rules set out below govern participation in the Trading Simulation. Each team is responsible for understanding and following these rules throughout the competition.\n\n# 1. COMPETITION OVERVIEW\n\n1.1 The Trading Simulation is the first round of the competition. Teams that qualify will move on to the second round, called the Dalal Street round. The organisers will announce the number of qualifying teams before the event starts.\n\n1.2 Each team will start with ₹10,00,000 in virtual cash. No real money will be used during the competition.\n\n1.3 Teams will trade 10 assets: 8 fictional companies and 2 commodities, gold and silver.\n\n1.4 The fictional companies and their trading codes are listed below:\n\n| **COMPANY** | **TRADING CODE** |\n| --- | --- |\n| Vardhan Bank Limited | VRDB |\n| Orbit Infotech Limited | ORBT |\n| Arogya Pharma Limited | AROG |\n| Sunfield Consumer Limited | SNFD |\n| Veloce Motors Limited | VLCM |\n| Konark Steel Limited | KNRK |\n| Tarang Telecom Limited | TRNG |\n| Helios Green Power Limited | HLGP |\n| Gold | GOLD |\n| Silver | SILVER |\n\n1.5 The companies, news and price charts have been created for this competition. Any similarity to an actual company is unintentional.\n\n1.6 The competition will have 3 phases. Teams may only buy assets in Phase 1. They may buy and sell assets in Phases 2 and 3.\n\n1.7 Each phase will last 10 minutes. Teams must review the news pack and submit their orders within this time.\n\n1.8 The team with the highest combined value of cash and assets at the end of Phase 3 will win the competition.\n\n# 2. PHASE PROCEDURE\n\n2.1 The organisers will share a news pack at the start of each phase.\n\n2.2 The opening prices for each phase will be shared with teams. Phase 1 opening prices will be included in its news pack. Phase 2 and Phase 3 opening prices will be shown on the screen.\n\n2.3 A 10-minute countdown will start, and the order submission form will open.\n\n2.4 Each team must submit its order using the designated form before the countdown ends.\n\n2.5 When the countdown ends, the form will close. The organisers will process the orders and publish the leaderboard.\n\n# 3. TEAM REGISTRATION AND ORDER SUBMISSION\n\n3.1 Each team must register 1 team name and use the same name in all 3 phases.\n\n3.2 Orders must be submitted only through the official form for that phase. 1 team member must submit the order for the whole team.\n\n3.3 Teams must enter a whole number of lots for each asset code. Enter 0 for any asset the team does not want to trade.\n\n3.4 In Phases 2 and 3, a positive number means a purchase and a negative number means a sale. For example, 50 means buying 50 lots, while -50 means selling 50 lots.\n\n3.5 The total cost of purchases must not be more than the team's available cash. If an order exceeds the available cash, the team will be disqualified.\n\n3.6 Teams must check all entries carefully before submitting an order.\n\n3.7 Orders must be submitted before the countdown ends. Late orders will not be accepted.\n\n3.8 Any query about a team's result must be raised with the organising team within 10 minutes after the leaderboard is displayed.\n\n# 4. PERMITTED ACTIONS\n\n4.1 Teams may buy any of the 10 available assets in any phase.\n\n4.2 Teams may sell only the lots they already own, and only in Phases 2 and 3.\n\n4.3 Money received from sales may be used to pay for purchases in the same order submission.\n\n4.4 Teams may keep some or all of their available funds as cash. Cash balances will not earn interest.\n\n4.5 A team may submit more than 1 order during a phase. Only the last order submitted before the form closes will be considered. It will replace all earlier orders for that phase.\n\n4.6 A team may choose not to submit an order in Phase 2 or Phase 3. If it does not submit an order, its cash balance and asset holdings will remain unchanged.\n\n4.7 Team members may discuss and agree on their trading strategy within their own team.\n\n4.8 Teams may add a short explanation of their trades in the submission form. This is optional and will not affect their score.\n\n# 5. PROHIBITED ACTIONS\n\n5.1 Teams must not sell any asset during Phase 1.\n\n5.2 Short selling is not allowed. Teams may sell only the lots they already own.\n\n5.3 Orders must not include fractional lots, such as 1.5 lots.\n\n5.4 Teams must not spend more cash than they have available.\n\n5.5 Teams must use their registered name in all phases. They must not change their team name or submit an order using another team's name.\n\n5.6 Teams must not share their orders with other teams or plan trades together with them.\n\n5.7 Teams must submit orders only through the official form and before the countdown ends.\n\n5.8 A team that has not registered before Phase 1 cannot join in Phase 2 or Phase 3.\n\n# 6. INVALID ORDERS AND DISQUALIFICATION\n\n6.1 A team will be disqualified if the total cost of its purchases is more than its available cash.\n\n6.2 A team will be disqualified if it engages in short selling. This also includes entering a negative number in Phase 1, when selling is not allowed.\n\n6.3 A team will be disqualified if it shares orders, plans trades with another team or submits an order using another team's name.\n\n6.4 If a team submits more than 1 order during a phase, only its last order submitted before the form closes will be checked. The team may correct an entry by submitting a replacement order while the form is still open.\n\n6.5 Any order with another error, including a fractional lot, will be rejected in full. The following will happen if an order is rejected:\n\n6.5.1 In Phase 1, the team will keep its starting cash balance of ₹10,00,000 until Phase 2.\n\n6.5.2 In Phases 2 and 3, the team's cash balance and asset holdings will remain unchanged.\n\n6.6 A registered team that does not submit an order in Phase 1 will keep its starting cash balance of ₹10,00,000 until Phase 2.\n\n# 7. PRICING, VALUATION AND RANKINGS\n\n7.1 All trades submitted during a phase will take place at that phase's opening prices. Prices will not change while the order form is open.\n\n7.2 The opening prices in each new phase will reflect the news and the trading activity of all teams. A major event may change an asset's price before the next phase starts. Any such event will be mentioned in the relevant news pack.\n\n7.3 No brokerage charges, taxes, dividends or interest will apply during the simulation.\n\n7.4 The organisers will publish a leaderboard after each phase.\n\n7.5 The final ranking will be based on the total value of each team's cash balance and asset holdings, using the final prices after Phase 3.\n\n7.6 If 2 teams have the same final value, the team with the higher total value after Phase 2 will rank higher. If they are still tied, the team that submitted its last Phase 3 order earlier will rank higher.\n\n# 8. CONDUCT AND DISPUTE RESOLUTION\n\n8.1 All participants must treat other teams and the organising team respectfully throughout the event.\n\n8.2 Teams must make their trading decisions using the information in the news pack and their own judgement.\n\n8.3 All questions about the competition or its results must be sent to the organising team. Teams must not raise these questions with other participating teams.\n\n8.4 The organisers will make the final decision on any question or dispute.";
