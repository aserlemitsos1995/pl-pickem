import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { getCompetition } from "@/lib/football-data";
import { syncClubs, syncFixtures } from "@/lib/sync";
import { computeResult, opponentClubId } from "@/lib/game-logic";
import picksData from "./data/2025-26-picks.json";

const SEASON_LABEL = "2025-26";
const API_SEASON_YEAR = 2025;

// The spreadsheet's club names don't always match football-data.org's shortName
// for that club — map the former to the latter so picks resolve to real Clubs.
const CLUB_ALIASES: Record<string, string> = {
  Spurs: "Tottenham",
  "Nott'm Forest": "Nottingham",
  "Man Utd": "Man United",
  Wolves: "Wolverhampton",
  Brighton: "Brighton Hove",
  Leeds: "Leeds United",
};

const PLAYER_ALIASES: Record<string, { slug: string; teamName: string }> = {
  "Serlemitsos FC": { slug: "serlemitsos", teamName: "Serlemitsos FC" },
  "Mudaliar Athletic": { slug: "mudaliar", teamName: "Mudaliar Athletic" },
  "AC Foley": { slug: "foley", teamName: "AC Foley" },
  "Jarvis United": { slug: "jarvis", teamName: "Jarvis United" },
};

interface RawPick {
  gameweek: number;
  team: string;
  selectedClub: string;
}

async function upsertSeason() {
  const competition = await getCompetition();
  const seasonInfo = competition.seasons.find((s) => s.startDate.startsWith(String(API_SEASON_YEAR)));
  if (!seasonInfo) throw new Error(`Could not find ${API_SEASON_YEAR} season in football-data.org response`);

  return prisma.season.upsert({
    where: { label: SEASON_LABEL },
    update: {},
    create: {
      label: SEASON_LABEL,
      apiSeasonYear: API_SEASON_YEAR,
      startDate: new Date(seasonInfo.startDate),
      endDate: new Date(seasonInfo.endDate),
      isCurrent: false,
      totalGameweeks: 38,
      secondHalfStartsAt: 20,
    },
  });
}

async function linkPlayers(seasonId: string, teamNames: Set<string>) {
  const playerSeasonByTeamName = new Map<string, string>();
  for (const teamName of teamNames) {
    const meta = PLAYER_ALIASES[teamName];
    if (!meta) throw new Error(`No player alias configured for historical team "${teamName}"`);

    const player = await prisma.player.findUniqueOrThrow({ where: { slug: meta.slug } });
    const managerName = MANAGER_BY_SLUG[meta.slug];
    const playerSeason = await prisma.playerSeason.upsert({
      where: { seasonId_playerId: { seasonId, playerId: player.id } },
      update: { teamName: meta.teamName, managerName, active: true },
      create: { seasonId, playerId: player.id, teamName: meta.teamName, managerName, active: true },
    });
    playerSeasonByTeamName.set(teamName, playerSeason.id);
  }
  return playerSeasonByTeamName;
}

// Manager names are stable across seasons even where team names changed.
const MANAGER_BY_SLUG: Record<string, string> = {
  serlemitsos: "AJ Serlemitsos",
  mudaliar: "Suneel Mudaliar",
  foley: "Conor Foley",
  jarvis: "Greg Jarvis",
};

async function importPicks(seasonId: string, playerSeasonByTeamName: Map<string, string>) {
  const clubs = await prisma.club.findMany({ where: { seasonId } });
  const clubByName = new Map(clubs.map((c) => [c.name, c]));

  const fixtures = await prisma.fixture.findMany({ where: { seasonId } });
  const fixtureByGameweekAndClub = new Map<string, (typeof fixtures)[number]>();
  for (const f of fixtures) {
    fixtureByGameweekAndClub.set(`${f.gameweek}:${f.homeClubId}`, f);
    fixtureByGameweekAndClub.set(`${f.gameweek}:${f.awayClubId}`, f);
  }

  const raw = picksData as RawPick[];
  let created = 0;
  for (const p of raw) {
    const playerSeasonId = playerSeasonByTeamName.get(p.team);
    if (!playerSeasonId) throw new Error(`Unknown historical team "${p.team}"`);

    const clubApiName = CLUB_ALIASES[p.selectedClub] ?? p.selectedClub;
    const club = clubByName.get(clubApiName);
    if (!club) throw new Error(`Unknown club "${p.selectedClub}" (mapped to "${clubApiName}")`);

    const fixture = fixtureByGameweekAndClub.get(`${p.gameweek}:${club.id}`);
    if (!fixture) throw new Error(`No fixture found for ${club.name} in gameweek ${p.gameweek}`);

    const outcome = computeResult(fixture, club.id) ?? { result: "DNP" as const, points: 0 };

    await prisma.pick.upsert({
      where: { playerSeasonId_gameweek: { playerSeasonId, gameweek: p.gameweek } },
      update: {
        clubId: club.id,
        fixtureId: fixture.id,
        result: outcome.result,
        points: outcome.points,
      },
      create: {
        seasonId,
        playerSeasonId,
        gameweek: p.gameweek,
        clubId: club.id,
        fixtureId: fixture.id,
        result: outcome.result,
        points: outcome.points,
      },
    });
    created++;
  }
  return created;
}

async function main() {
  console.log(`Upserting season ${SEASON_LABEL}...`);
  const season = await upsertSeason();

  console.log("Syncing clubs from football-data.org...");
  await syncClubs(season.id, season.apiSeasonYear);

  console.log("Syncing fixtures from football-data.org...");
  const fixtureCount = await syncFixtures(season.id, season.apiSeasonYear);
  console.log(`Synced ${fixtureCount} fixtures.`);

  const raw = picksData as RawPick[];
  const teamNames = new Set(raw.map((p) => p.team));

  console.log("Linking historical players to season...");
  const playerSeasonByTeamName = await linkPlayers(season.id, teamNames);

  console.log("Importing picks...");
  const pickCount = await importPicks(season.id, playerSeasonByTeamName);
  console.log(`Imported ${pickCount} picks.`);

  // Sanity check: every opponent-cap / half-repeat rule should hold for the
  // imported history, same as it would for a live season.
  const picks = await prisma.pick.findMany({ where: { seasonId: season.id }, include: { fixture: true } });
  const byPlayer = new Map<string, typeof picks>();
  for (const p of picks) {
    byPlayer.set(p.playerSeasonId, [...(byPlayer.get(p.playerSeasonId) ?? []), p]);
  }
  for (const [playerSeasonId, playerPicks] of byPlayer) {
    const firstHalf = playerPicks.filter((p) => p.gameweek < 20);
    const secondHalf = playerPicks.filter((p) => p.gameweek >= 20);
    for (const half of [firstHalf, secondHalf]) {
      const seen = new Set<string>();
      for (const p of half) {
        if (!p.clubId) continue; // DNP — nothing picked
        if (seen.has(p.clubId)) console.warn(`Half-repeat violation: playerSeason ${playerSeasonId}, club ${p.clubId}`);
        seen.add(p.clubId);
      }
    }
    const oppCounts = new Map<string, number>();
    for (const p of playerPicks) {
      if (!p.fixture || !p.clubId) continue; // DNP — no opponent to count
      const oppId = opponentClubId(p.fixture, p.clubId);
      oppCounts.set(oppId, (oppCounts.get(oppId) ?? 0) + 1);
    }
    for (const [oppId, count] of oppCounts) {
      if (count > 4) console.warn(`Opponent-cap violation: playerSeason ${playerSeasonId}, opponent ${oppId}, count ${count}`);
    }
  }

  console.log("Historical import complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
