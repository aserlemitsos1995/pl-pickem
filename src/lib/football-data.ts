const BASE_URL = "https://api.football-data.org/v4";

function apiToken(): string {
  const token = process.env.FOOTBALL_DATA_API_TOKEN;
  if (!token) throw new Error("FOOTBALL_DATA_API_TOKEN is not set");
  return token;
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "X-Auth-Token": apiToken() },
    // football-data.org data changes slowly enough that a short cache avoids
    // hammering the free-tier rate limit (10 req/min) during bursts of traffic.
    next: { revalidate: 60 },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`football-data.org request failed (${res.status}): ${body}`);
  }
  return res.json() as Promise<T>;
}

export interface ApiTeam {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string;
}

export interface ApiMatch {
  id: number;
  utcDate: string;
  status:
    | "SCHEDULED"
    | "TIMED"
    | "IN_PLAY"
    | "PAUSED"
    | "FINISHED"
    | "POSTPONED"
    | "SUSPENDED"
    | "CANCELLED"
    | "AWARDED";
  matchday: number;
  homeTeam: ApiTeam;
  awayTeam: ApiTeam;
  score: {
    fullTime: { home: number | null; away: number | null };
  };
}

interface CompetitionSeason {
  id: number;
  startDate: string;
  endDate: string;
  currentMatchday: number;
}

interface CompetitionResponse {
  currentSeason: CompetitionSeason;
  seasons: CompetitionSeason[];
}

interface MatchesResponse {
  matches: ApiMatch[];
}

interface TeamsResponse {
  teams: ApiTeam[];
}

/** The PL competition record, including every season football-data.org knows about. */
export async function getCompetition() {
  return apiFetch<CompetitionResponse>("/competitions/PL");
}

/** The 20 clubs registered for a given season (e.g. 2026 for the 2026-27 season). */
export async function getSeasonTeams(apiSeasonYear: number) {
  const data = await apiFetch<TeamsResponse>(`/competitions/PL/teams?season=${apiSeasonYear}`);
  return data.teams;
}

/** All 380 fixtures for a given season, including postponed/rescheduled ones. */
export async function getSeasonMatches(apiSeasonYear: number) {
  const data = await apiFetch<MatchesResponse>(`/competitions/PL/matches?season=${apiSeasonYear}`);
  return data.matches;
}
