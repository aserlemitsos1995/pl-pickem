import { prisma } from "@/lib/prisma";
import type { FixtureStatus, PickResult } from "@/generated/prisma/enums";

export const OPPONENT_CAP = 4;

const FINISHED_LIKE: FixtureStatus[] = ["FINISHED", "AWARDED"];
const VOID_LIKE: FixtureStatus[] = ["CANCELLED"];

/** Which half of the season a gameweek falls in, given the season's boundary. */
export function halfForGameweek(gameweek: number, secondHalfStartsAt: number): 1 | 2 {
  return gameweek < secondHalfStartsAt ? 1 : 2;
}

/** The range of gameweeks [start, end] that make up the half containing `gameweek`. */
export function halfRange(gameweek: number, secondHalfStartsAt: number, totalGameweeks: number) {
  return halfForGameweek(gameweek, secondHalfStartsAt) === 1
    ? { start: 1, end: secondHalfStartsAt - 1 }
    : { start: secondHalfStartsAt, end: totalGameweeks };
}

export function opponentClubId(fixture: { homeClubId: string; awayClubId: string }, clubId: string) {
  return fixture.homeClubId === clubId ? fixture.awayClubId : fixture.homeClubId;
}

/** Win/Tie/Loss/DNP + points for a club in a given fixture, or null if not yet decided. */
export function computeResult(
  fixture: { status: FixtureStatus; homeClubId: string; awayClubId: string; homeGoals: number | null; awayGoals: number | null },
  clubId: string,
): { result: PickResult; points: number } | null {
  if (VOID_LIKE.includes(fixture.status)) {
    return { result: "DNP", points: 0 };
  }
  if (!FINISHED_LIKE.includes(fixture.status)) {
    return null;
  }
  if (fixture.homeGoals === null || fixture.awayGoals === null) {
    return null;
  }
  const isHome = fixture.homeClubId === clubId;
  const goalsFor = isHome ? fixture.homeGoals : fixture.awayGoals;
  const goalsAgainst = isHome ? fixture.awayGoals : fixture.homeGoals;
  if (goalsFor === goalsAgainst) return { result: "TIE", points: 1 };
  if (goalsFor > goalsAgainst) return { result: "WIN", points: 3 };
  return { result: "LOSS", points: 0 };
}

export class PickValidationError extends Error {}

interface ValidatePickArgs {
  seasonId: string;
  playerSeasonId: string;
  gameweek: number;
  clubId: string;
  fixtureId: string;
  /** Set when the commissioner is overriding — skips the kickoff deadline check. */
  isAdminOverride?: boolean;
}

/**
 * Throws PickValidationError if the pick would violate a rule:
 *  - fixture must belong to the requested club + gameweek
 *  - deadline: the fixture must not have kicked off yet (unless admin override)
 *  - no repeat club within the same half of the season
 *  - opponent cap: at most OPPONENT_CAP picks against any single club per season
 */
export async function validatePick(args: ValidatePickArgs) {
  const { seasonId, playerSeasonId, gameweek, clubId, fixtureId, isAdminOverride } = args;

  const [season, fixture, existingPickThisGameweek] = await Promise.all([
    prisma.season.findUniqueOrThrow({ where: { id: seasonId } }),
    prisma.fixture.findUniqueOrThrow({ where: { id: fixtureId } }),
    prisma.pick.findUnique({ where: { playerSeasonId_gameweek: { playerSeasonId, gameweek } } }),
  ]);

  if (fixture.gameweek !== gameweek) {
    throw new PickValidationError("That fixture is not in the selected gameweek.");
  }
  if (fixture.homeClubId !== clubId && fixture.awayClubId !== clubId) {
    throw new PickValidationError("That club is not playing in the selected fixture.");
  }

  if (!isAdminOverride && fixture.kickoff.getTime() <= Date.now()) {
    throw new PickValidationError("Picks lock at kickoff — this match has already started.");
  }

  const { start, end } = halfRange(gameweek, season.secondHalfStartsAt, season.totalGameweeks);
  const halfPicks = await prisma.pick.findMany({
    where: {
      playerSeasonId,
      gameweek: { gte: start, lte: end, not: gameweek },
    },
    select: { clubId: true },
  });
  if (halfPicks.some((p) => p.clubId === clubId)) {
    throw new PickValidationError("You've already picked this club during this half of the season.");
  }

  const opponentId = opponentClubId(fixture, clubId);
  const seasonPicks = await prisma.pick.findMany({
    where: { playerSeasonId, gameweek: { not: gameweek } },
    include: { fixture: true },
  });
  const timesPickedAgainstOpponent = seasonPicks.filter(
    (p) => opponentClubId(p.fixture, p.clubId) === opponentId,
  ).length;
  if (timesPickedAgainstOpponent >= OPPONENT_CAP) {
    throw new PickValidationError(
      `You've already picked against this club ${OPPONENT_CAP} times this season — the limit.`,
    );
  }

  return { existingPickThisGameweek };
}

/** Recompute result/points for every settled fixture's picks. Safe to run repeatedly. */
export async function settlePicks(seasonId: string) {
  const picks = await prisma.pick.findMany({
    where: { seasonId, result: null },
    include: { fixture: true },
  });

  let settled = 0;
  for (const pick of picks) {
    const outcome = computeResult(pick.fixture, pick.clubId);
    if (!outcome) continue;
    await prisma.pick.update({
      where: { id: pick.id },
      data: { result: outcome.result, points: outcome.points },
    });
    settled++;
  }
  return settled;
}
