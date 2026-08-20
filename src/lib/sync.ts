import { prisma } from "@/lib/prisma";
import { getSeasonTeams, getSeasonMatches } from "@/lib/football-data";

export async function syncClubs(seasonId: string, apiSeasonYear: number) {
  const teams = await getSeasonTeams(apiSeasonYear);
  const clubs = [];
  for (const team of teams) {
    const club = await prisma.club.upsert({
      where: { seasonId_apiTeamId: { seasonId, apiTeamId: team.id } },
      update: { name: team.shortName, fullName: team.name, crestUrl: team.crest },
      create: {
        seasonId,
        apiTeamId: team.id,
        name: team.shortName,
        fullName: team.name,
        crestUrl: team.crest,
      },
    });
    clubs.push(club);
  }
  return clubs;
}

/**
 * Upserts fixtures for a season. `gameweek` is only set on create — a
 * postponed-and-rescheduled match keeps its original gameweek even though
 * football-data.org may move its kickoff date, per the league's house rules.
 */
export async function syncFixtures(seasonId: string, apiSeasonYear: number) {
  const matches = await getSeasonMatches(apiSeasonYear);
  const clubs = await prisma.club.findMany({ where: { seasonId } });
  const clubByApiId = new Map(clubs.map((c) => [c.apiTeamId, c]));

  let synced = 0;
  for (const match of matches) {
    const homeClub = clubByApiId.get(match.homeTeam.id);
    const awayClub = clubByApiId.get(match.awayTeam.id);
    if (!homeClub || !awayClub) {
      console.warn(`Skipping match ${match.id}: unknown club (${match.homeTeam.name} vs ${match.awayTeam.name})`);
      continue;
    }
    await prisma.fixture.upsert({
      where: { apiMatchId: match.id },
      update: {
        status: match.status,
        kickoff: new Date(match.utcDate),
        homeGoals: match.score.fullTime.home,
        awayGoals: match.score.fullTime.away,
        lastSyncedAt: new Date(),
      },
      create: {
        seasonId,
        apiMatchId: match.id,
        gameweek: match.matchday,
        kickoff: new Date(match.utcDate),
        status: match.status,
        homeClubId: homeClub.id,
        awayClubId: awayClub.id,
        homeGoals: match.score.fullTime.home,
        awayGoals: match.score.fullTime.away,
      },
    });
    synced++;
  }
  return synced;
}
