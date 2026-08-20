-- AlterTable: a Pick can now represent "did not pick" with no club/fixture attached.
ALTER TABLE "Pick" ALTER COLUMN "clubId" DROP NOT NULL;
ALTER TABLE "Pick" ALTER COLUMN "fixtureId" DROP NOT NULL;
