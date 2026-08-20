import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { getCompetition } from "@/lib/football-data";
import { syncClubs, syncFixtures } from "@/lib/sync";

const PLAYERS: Array<{
  slug: string;
  teamName: string;
  managerName: string;
  isCommissioner?: boolean;
}> = [
  { slug: "serlemitsos", teamName: "Sporting Serlemitsos", managerName: "AJ Serlemitsos", isCommissioner: true },
  { slug: "mudaliar", teamName: "Real Mudaliar", managerName: "Suneel Mudaliar" },
  { slug: "foley", teamName: "AC Foley", managerName: "Conor Foley" },
  { slug: "jarvis", teamName: "Jarvis United", managerName: "Greg Jarvis" },
  { slug: "falkner", teamName: "Falkner FC", managerName: "Matthew Falkner" },
  { slug: "derosa", teamName: "Inter DeRosa", managerName: "Christian DeRosa" },
];

const CURRENT_SEASON_API_YEAR = 2026;
const CURRENT_SEASON_LABEL = "2026-27";

async function upsertPlayers() {
  const players = [];
  for (const p of PLAYERS) {
    const player = await prisma.player.upsert({
      where: { slug: p.slug },
      update: { isCommissioner: p.isCommissioner ?? false },
      create: { slug: p.slug, isCommissioner: p.isCommissioner ?? false },
    });
    players.push({ player, meta: p });
  }
  return players;
}

async function upsertSeason() {
  const competition = await getCompetition();
  const seasonInfo = competition.seasons.find((s) => s.startDate.startsWith(String(CURRENT_SEASON_API_YEAR)));
  if (!seasonInfo) throw new Error(`Could not find ${CURRENT_SEASON_API_YEAR} season in football-data.org response`);

  return prisma.season.upsert({
    where: { label: CURRENT_SEASON_LABEL },
    update: {},
    create: {
      label: CURRENT_SEASON_LABEL,
      apiSeasonYear: CURRENT_SEASON_API_YEAR,
      startDate: new Date(seasonInfo.startDate),
      endDate: new Date(seasonInfo.endDate),
      isCurrent: true,
      totalGameweeks: 38,
      secondHalfStartsAt: 20,
    },
  });
}

async function main() {
  console.log("Upserting players...");
  const players = await upsertPlayers();

  console.log(`Upserting season ${CURRENT_SEASON_LABEL}...`);
  const season = await upsertSeason();

  console.log("Syncing clubs from football-data.org...");
  await syncClubs(season.id, season.apiSeasonYear);

  console.log("Syncing fixtures from football-data.org...");
  const fixtureCount = await syncFixtures(season.id, season.apiSeasonYear);
  console.log(`Synced ${fixtureCount} fixtures.`);

  console.log("Linking players to season...");
  for (const { player, meta } of players) {
    await prisma.playerSeason.upsert({
      where: { seasonId_playerId: { seasonId: season.id, playerId: player.id } },
      update: { teamName: meta.teamName, managerName: meta.managerName, active: true },
      create: {
        seasonId: season.id,
        playerId: player.id,
        teamName: meta.teamName,
        managerName: meta.managerName,
        active: true,
      },
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
