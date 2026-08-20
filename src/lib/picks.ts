import { prisma } from "@/lib/prisma";
import { OPPONENT_CAP, halfRange, opponentClubId } from "@/lib/game-logic";

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

  const usedThisHalf = new Set(halfPicks.map((p) => p.clubId));
  const opponentCounts = new Map<string, number>();
  for (const p of seasonPicks) {
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

/** Every player's picked-clubs and picked-against grids for a season — mirrors the original spreadsheet. */
export async function getSeasonGrids(seasonId: string): Promise<SeasonGrids> {
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

  for (const p of picks) {
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
