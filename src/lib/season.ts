import { prisma } from "@/lib/prisma";

export async function getCurrentSeason() {
  return prisma.season.findFirstOrThrow({ where: { isCurrent: true } });
}

export async function getAllSeasons() {
  return prisma.season.findMany({ orderBy: { startDate: "desc" } });
}

/**
 * The gameweek a player should land on: the lowest-numbered gameweek that still
 * has at least one fixture that hasn't kicked off yet. Falls back to the final
 * gameweek once the whole season has kicked off (so late viewers see something).
 */
export async function getDefaultGameweek(seasonId: string): Promise<number> {
  const next = await prisma.fixture.findFirst({
    where: { seasonId, kickoff: { gt: new Date() } },
    orderBy: { kickoff: "asc" },
    select: { gameweek: true },
  });
  if (next) return next.gameweek;

  const last = await prisma.fixture.findFirst({
    where: { seasonId },
    orderBy: { gameweek: "desc" },
    select: { gameweek: true },
  });
  return last?.gameweek ?? 1;
}
