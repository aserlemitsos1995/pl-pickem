-- AlterTable
ALTER TABLE "Fixture" ADD COLUMN     "homeOdds" INTEGER,
ADD COLUMN     "drawOdds" INTEGER,
ADD COLUMN     "awayOdds" INTEGER,
ADD COLUMN     "oddsUpdatedAt" TIMESTAMP(3);
