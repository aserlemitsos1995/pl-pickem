import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { syncOdds } from "@/lib/sync";

async function main() {
  const season = await prisma.season.findFirstOrThrow({ where: { isCurrent: true } });
  console.log(`Syncing DraftKings odds for ${season.label}...`);
  const updated = await syncOdds(season.id);
  console.log(`Updated odds for ${updated} fixtures.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
