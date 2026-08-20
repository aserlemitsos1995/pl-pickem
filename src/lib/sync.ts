import { prisma } from "@/lib/prisma";
import { getSeasonTeams, getSeasonMatches } from "@/lib/football-data";
import { getEplDraftKingsOdds, normalizeClubName } from "@/lib/odds";

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

/**
 * Pulls DraftKings moneyline odds for upcoming EPL matches and attaches them
 * to the matching Fixture rows. Matches events to fixtures by normalized club
 * full name plus home/away orientation (each pair of clubs meets exactly once
 * per venue per season, so that pair uniquely identifies the fixture).
 */
export async function syncOdds(seasonId: string) {
  const clubs = await prisma.club.findMany({ where: { seasonId } });
  const clubByNormalizedName = new Map(clubs.map((c) => [normalizeClubName(c.fullName), c]));

  const events = await getEplDraftKingsOdds();
  let updated = 0;
  for (const event of events) {
    const homeClub = clubByNormalizedName.get(normalizeClubName(event.homeTeam));
    const awayClub = clubByNormalizedName.get(normalizeClubName(event.awayTeam));
    if (!homeClub || !awayClub) {
      console.warn(`Skipping odds event: unrecognized club (${event.homeTeam} vs ${event.awayTeam})`);
      continue;
    }
    const fixture = await prisma.fixture.findFirst({
      where: { seasonId, homeClubId: homeClub.id, awayClubId: awayClub.id },
    });
    if (!fixture) continue;

    await prisma.fixture.update({
      where: { id: fixture.id },
      data: {
        homeOdds: event.homeOdds,
        drawOdds: event.drawOdds,
        awayOdds: event.awayOdds,
        oddsUpdatedAt: new Date(),
      },
    });
    updated++;
  }
  return updated;
}
