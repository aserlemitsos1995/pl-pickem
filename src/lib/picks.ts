import { prisma } from "@/lib/prisma";
import { OPPONENT_CAP, halfRange, opponentClubId } from "@/lib/game-logic";
import type { PickResult } from "@/generated/prisma/enums";

export interface ClubOption {
  clubId: string;
  name: string;
  crestUrl: string | null;
  side: "HOME" | "AWAY";
  disabled: boolean;
  disabledReason: string | null;
  isCurrentPick: boolean;
}

export interface FixtureBoardRow {
  fixtureId: string;
  kickoff: string;
  status: string;
  locked: boolean;
  home: ClubOption;
  away: ClubOption;
  homeOdds: number | null;
  drawOdds: number | null;
  awayOdds: number | null;
}

export interface GameweekBoard {
  gameweek: number;
  fixtures: FixtureBoardRow[];
  currentPickClubId: string | null;
}

export async function getGameweekBoard(
  playerSeasonId: string,
  seasonId: string,
  gameweek: number,
  options: { bypassLock?: boolean } = {},
): Promise<GameweekBoard> {
  const { bypassLock = false } = options;
  const season = await prisma.season.findUniqueOrThrow({ where: { id: seasonId } });
  const { start, end } = halfRange(gameweek, season.secondHalfStartsAt, season.totalGameweeks);

  const [fixtures, halfPicks, seasonPicks, currentPick] = await Promise.all([
    prisma.fixture.findMany({
      where: { seasonId, gameweek },
      include: { homeClub: true, awayClub: true },
      orderBy: { kickoff: "asc" },
    }),
    prisma.pick.findMany({
      where: { playerSeasonId, gameweek: { gte: start, lte: end, not: gameweek } },
      select: { clubId: true },
    }),
    prisma.pick.findMany({
      where: { playerSeasonId, gameweek: { not: gameweek } },
      include: { fixture: true },
    }),
    prisma.pick.findUnique({ where: { playerSeasonId_gameweek: { playerSeasonId, gameweek } } }),
  ]);

  const usedThisHalf = new Set(halfPicks.map((p) => p.clubId).filter((id): id is string => id !== null));
  const opponentCounts = new Map<string, number>();
  for (const p of seasonPicks) {
    if (!p.fixture || !p.clubId) continue; // DNP — no club/opponent to count
    const oppId = opponentClubId(p.fixture, p.clubId);
    opponentCounts.set(oppId, (opponentCounts.get(oppId) ?? 0) + 1);
  }

  const now = Date.now();

  function buildOption(
    clubId: string,
    name: string,
    crestUrl: string | null,
    side: "HOME" | "AWAY",
    opponentId: string,
    locked: boolean,
  ): ClubOption {
    const isCurrentPick = currentPick?.clubId === clubId;
    let disabledReason: string | null = null;
    if (locked && !isCurrentPick && !bypassLock) disabledReason = "Kicked off";
    else if (usedThisHalf.has(clubId)) disabledReason = "Already picked this half";
    else if ((opponentCounts.get(opponentId) ?? 0) >= OPPONENT_CAP) disabledReason = `Picked against ${OPPONENT_CAP}x already`;

    return {
      clubId,
      name,
      crestUrl,
      side,
      disabled: disabledReason !== null,
      disabledReason,
      isCurrentPick,
    };
  }

  const rows: FixtureBoardRow[] = fixtures.map((f) => {
    const locked = f.kickoff.getTime() <= now;
    return {
      fixtureId: f.id,
      kickoff: f.kickoff.toISOString(),
      status: f.status,
      locked,
      home: buildOption(f.homeClubId, f.homeClub.name, f.homeClub.crestUrl, "HOME", f.awayClubId, locked),
      away: buildOption(f.awayClubId, f.awayClub.name, f.awayClub.crestUrl, "AWAY", f.homeClubId, locked),
      homeOdds: f.homeOdds,
      drawOdds: f.drawOdds,
      awayOdds: f.awayOdds,
    };
  });

  return { gameweek, fixtures: rows, currentPickClubId: currentPick?.clubId ?? null };
}

export interface ClubPickSummary {
  clubId: string;
  name: string;
  crestUrl: string | null;
}

/** For the "clubs I've already picked" grid: club ids picked in each half of the season. */
export async function getClubsPickedByHalf(playerSeasonId: string, seasonId: string) {
  const season = await prisma.season.findUniqueOrThrow({ where: { id: seasonId } });
  const picks = await prisma.pick.findMany({
    where: { playerSeasonId },
    include: { club: true },
  });
  const firstHalf = new Set<string>();
  const secondHalf = new Set<string>();
  for (const p of picks) {
    if (!p.clubId) continue; // DNP — nothing picked
    if (p.gameweek < season.secondHalfStartsAt) firstHalf.add(p.clubId);
    else secondHalf.add(p.clubId);
  }
  return { firstHalf, secondHalf };
}

/** For the "clubs I've picked against" grid: opponent club id -> count, for the whole season. */
export async function getOpponentCounts(playerSeasonId: string): Promise<Map<string, number>> {
  const picks = await prisma.pick.findMany({
    where: { playerSeasonId },
    include: { fixture: true },
  });
  const counts = new Map<string, number>();
  for (const p of picks) {
    if (!p.fixture || !p.clubId) continue; // DNP — no opponent to count
    const oppId = opponentClubId(p.fixture, p.clubId);
    counts.set(oppId, (counts.get(oppId) ?? 0) + 1);
  }
  return counts;
}

export interface SeasonGrids {
  clubs: { id: string; name: string }[];
  players: { playerSeasonId: string; teamName: string }[];
  firstHalfPicked: Map<string, Set<string>>; // playerSeasonId -> clubIds
  secondHalfPicked: Map<string, Set<string>>;
  opponentCounts: Map<string, Map<string, number>>; // playerSeasonId -> clubId -> count
}

/**
 * Every player's picked-clubs and picked-against grids for a season — mirrors the original spreadsheet.
 * A pick for a fixture that hasn't kicked off yet is only visible to the player who made it (or an admin) —
 * everyone else's board simply doesn't reflect it until kickoff.
 */
export async function getSeasonGrids(
  seasonId: string,
  viewer: { playerSeasonId: string | null; isAdmin: boolean },
): Promise<SeasonGrids> {
  const season = await prisma.season.findUniqueOrThrow({ where: { id: seasonId } });
  const [clubs, playerSeasons, picks] = await Promise.all([
    prisma.club.findMany({ where: { seasonId }, orderBy: { name: "asc" } }),
    prisma.playerSeason.findMany({ where: { seasonId }, orderBy: { teamName: "asc" } }),
    prisma.pick.findMany({ where: { seasonId }, include: { fixture: true } }),
  ]);

  const firstHalfPicked = new Map<string, Set<string>>();
  const secondHalfPicked = new Map<string, Set<string>>();
  const opponentCounts = new Map<string, Map<string, number>>();

  for (const ps of playerSeasons) {
    firstHalfPicked.set(ps.id, new Set());
    secondHalfPicked.set(ps.id, new Set());
    opponentCounts.set(ps.id, new Map());
  }

  const now = Date.now();
  for (const p of picks) {
    if (!p.fixture || !p.clubId) continue; // DNP — nothing picked, nothing to show in these grids
    const visible = viewer.isAdmin || p.playerSeasonId === viewer.playerSeasonId || p.fixture.kickoff.getTime() <= now;
    if (!visible) continue;

    const half = p.gameweek < season.secondHalfStartsAt ? firstHalfPicked : secondHalfPicked;
    half.get(p.playerSeasonId)?.add(p.clubId);

    const oppId = opponentClubId(p.fixture, p.clubId);
    const counts = opponentCounts.get(p.playerSeasonId);
    if (counts) counts.set(oppId, (counts.get(oppId) ?? 0) + 1);
  }

  return {
    clubs: clubs.map((c) => ({ id: c.id, name: c.name })),
    players: playerSeasons.map((ps) => ({ playerSeasonId: ps.id, teamName: ps.teamName })),
    firstHalfPicked,
    secondHalfPicked,
    opponentCounts,
  };
}

// Deliberately holds no club/result data — a hidden cell must never carry the pick it's hiding.
// clubName is null when the player didn't submit a pick that gameweek (DNP).
export type GameweekPickCell =
  | { visible: true; clubName: string | null; crestUrl: string | null; result: PickResult | null }
  | { visible: false };

export interface GameweekPicksGrid {
  gameweeks: number[]; // descending, most recent first; only gameweeks with at least one pick
  players: { playerSeasonId: string; teamName: string }[];
  cells: Map<number, Map<string, GameweekPickCell>>; // gameweek -> playerSeasonId -> cell
}

/**
 * Who picked which club, broken down by gameweek. Same visibility rule as getSeasonGrids: a pick
 * for a fixture that hasn't kicked off yet is only visible to the player who made it (or an admin).
 */
export async function getGameweekPicksGrid(
  seasonId: string,
  viewer: { playerSeasonId: string | null; isAdmin: boolean },
): Promise<GameweekPicksGrid> {
  const [playerSeasons, picks] = await Promise.all([
    prisma.playerSeason.findMany({ where: { seasonId }, orderBy: { teamName: "asc" } }),
    prisma.pick.findMany({ where: { seasonId }, include: { club: true, fixture: true } }),
  ]);

  const now = Date.now();
  const cells = new Map<number, Map<string, GameweekPickCell>>();

  for (const p of picks) {
    const visible =
      viewer.isAdmin ||
      p.playerSeasonId === viewer.playerSeasonId ||
      !p.fixture ||
      p.fixture.kickoff.getTime() <= now;
    const cell: GameweekPickCell = visible
      ? { visible: true, clubName: p.club?.name ?? null, crestUrl: p.club?.crestUrl ?? null, result: p.result }
      : { visible: false };

    if (!cells.has(p.gameweek)) cells.set(p.gameweek, new Map());
    cells.get(p.gameweek)!.set(p.playerSeasonId, cell);
  }

  const gameweeks = [...cells.keys()].sort((a, b) => b - a);

  return {
    gameweeks,
    players: playerSeasons.map((ps) => ({ playerSeasonId: ps.id, teamName: ps.teamName })),
    cells,
  };
}
