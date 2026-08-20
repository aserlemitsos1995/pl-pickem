const BASE_URL = "https://api.the-odds-api.com/v4";

function apiKey(): string {
  const key = process.env.ODDS_API_KEY;
  if (!key) throw new Error("ODDS_API_KEY is not set");
  return key;
}

interface OddsApiOutcome {
  name: string;
  price: number;
}

interface OddsApiMarket {
  key: string;
  outcomes: OddsApiOutcome[];
}

interface OddsApiBookmaker {
  key: string;
  markets: OddsApiMarket[];
}

interface OddsApiEvent {
  id: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsApiBookmaker[];
}

export interface DraftKingsFixtureOdds {
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  homeOdds: number | null;
  drawOdds: number | null;
  awayOdds: number | null;
}

/** Normalizes a club name for matching across data sources (drops "FC"/"AFC", punctuation, case). */
export function normalizeClubName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\bafc\b/g, "")
    .replace(/\bfc\b/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * DraftKings moneyline (h2h) odds for all upcoming EPL matches. Costs 1 credit
 * per call (1 bookmaker group x 1 market) against The Odds API's free tier.
 */
export async function getEplDraftKingsOdds(): Promise<DraftKingsFixtureOdds[]> {
  const url = `${BASE_URL}/sports/soccer_epl/odds/?apiKey=${apiKey()}&bookmakers=draftkings&markets=h2h&oddsFormat=american`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`The Odds API request failed (${res.status}): ${body}`);
  }
  const events = (await res.json()) as OddsApiEvent[];

  return events.map((event) => {
    const dk = event.bookmakers.find((b) => b.key === "draftkings");
    const h2h = dk?.markets.find((m) => m.key === "h2h");
    const priceFor = (teamName: string) => h2h?.outcomes.find((o) => o.name === teamName)?.price ?? null;
    return {
      homeTeam: event.home_team,
      awayTeam: event.away_team,
      commenceTime: event.commence_time,
      homeOdds: priceFor(event.home_team),
      drawOdds: priceFor("Draw"),
      awayOdds: priceFor(event.away_team),
    };
  });
}
