-- CreateEnum
CREATE TYPE "FixtureStatus" AS ENUM ('SCHEDULED', 'TIMED', 'IN_PLAY', 'PAUSED', 'FINISHED', 'POSTPONED', 'SUSPENDED', 'CANCELLED', 'AWARDED');

-- CreateEnum
CREATE TYPE "PickResult" AS ENUM ('WIN', 'TIE', 'LOSS', 'DNP');

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isCommissioner" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "apiSeasonYear" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "totalGameweeks" INTEGER NOT NULL DEFAULT 38,
    "secondHalfStartsAt" INTEGER NOT NULL DEFAULT 20,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerSeason" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "teamName" TEXT NOT NULL,
    "managerName" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PlayerSeason_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Club" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "apiTeamId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "crestUrl" TEXT,

    CONSTRAINT "Club_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fixture" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "apiMatchId" INTEGER NOT NULL,
    "gameweek" INTEGER NOT NULL,
    "kickoff" TIMESTAMP(3) NOT NULL,
    "status" "FixtureStatus" NOT NULL DEFAULT 'SCHEDULED',
    "homeClubId" TEXT NOT NULL,
    "awayClubId" TEXT NOT NULL,
    "homeGoals" INTEGER,
    "awayGoals" INTEGER,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fixture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pick" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "playerSeasonId" TEXT NOT NULL,
    "gameweek" INTEGER NOT NULL,
    "clubId" TEXT NOT NULL,
    "fixtureId" TEXT NOT NULL,
    "result" "PickResult",
    "points" INTEGER,
    "updatedByAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Player_slug_key" ON "Player"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Season_label_key" ON "Season"("label");

-- CreateIndex
CREATE UNIQUE INDEX "Season_apiSeasonYear_key" ON "Season"("apiSeasonYear");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerSeason_seasonId_playerId_key" ON "PlayerSeason"("seasonId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "Club_seasonId_apiTeamId_key" ON "Club"("seasonId", "apiTeamId");

-- CreateIndex
CREATE UNIQUE INDEX "Fixture_apiMatchId_key" ON "Fixture"("apiMatchId");

-- CreateIndex
CREATE INDEX "Fixture_seasonId_gameweek_idx" ON "Fixture"("seasonId", "gameweek");

-- CreateIndex
CREATE UNIQUE INDEX "Pick_playerSeasonId_gameweek_key" ON "Pick"("playerSeasonId", "gameweek");

-- AddForeignKey
ALTER TABLE "PlayerSeason" ADD CONSTRAINT "PlayerSeason_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerSeason" ADD CONSTRAINT "PlayerSeason_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Club" ADD CONSTRAINT "Club_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fixture" ADD CONSTRAINT "Fixture_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fixture" ADD CONSTRAINT "Fixture_homeClubId_fkey" FOREIGN KEY ("homeClubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fixture" ADD CONSTRAINT "Fixture_awayClubId_fkey" FOREIGN KEY ("awayClubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pick" ADD CONSTRAINT "Pick_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pick" ADD CONSTRAINT "Pick_playerSeasonId_fkey" FOREIGN KEY ("playerSeasonId") REFERENCES "PlayerSeason"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pick" ADD CONSTRAINT "Pick_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pick" ADD CONSTRAINT "Pick_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "Fixture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
