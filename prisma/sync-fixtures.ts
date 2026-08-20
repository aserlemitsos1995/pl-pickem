import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { syncFixtures } from "@/lib/sync";
import { settlePicks } from "@/lib/game-logic";

/**
 * Pulls latest fixture statuses/scores from football-data.org for the current
 * season and settles any picks whose fixture has since finished. Intended to
 * run on a schedule (e.g. every few minutes on matchdays via a cron trigger).
 */
async function main() {
  const season = await prisma.season.findFirstOrThrow({ where: { isCurrent: true } });

  console.log(`Syncing fixtures for ${season.label}...`);
  const synced = await syncFixtures(season.id, season.apiSeasonYear);
  console.log(`Synced ${synced} fixtures.`);

  console.log("Settling picks...");
  const settled = await settlePicks(season.id);
  console.log(`Settled ${settled} picks.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
