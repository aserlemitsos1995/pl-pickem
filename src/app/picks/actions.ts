"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentSeason } from "@/lib/season";
import { getCurrentPlayerSeason, getCurrentPlayer } from "@/lib/session";
import { validatePick, PickValidationError } from "@/lib/game-logic";

export type SubmitPickResult = { ok: true } | { ok: false; error: string };

export async function submitPick(gameweek: number, clubId: string, fixtureId: string): Promise<SubmitPickResult> {
  const season = await getCurrentSeason();
  const identity = await getCurrentPlayerSeason(season.id);
  if (!identity) return { ok: false, error: "Select your team before making a pick." };

  try {
    await validatePick({
      seasonId: season.id,
      playerSeasonId: identity.playerSeason.id,
      gameweek,
      clubId,
      fixtureId,
    });
  } catch (err) {
    if (err instanceof PickValidationError) return { ok: false, error: err.message };
    throw err;
  }

  await prisma.pick.upsert({
    where: { playerSeasonId_gameweek: { playerSeasonId: identity.playerSeason.id, gameweek } },
    update: { clubId, fixtureId, updatedByAdmin: false, result: null, points: null },
    create: {
      seasonId: season.id,
      playerSeasonId: identity.playerSeason.id,
      gameweek,
      clubId,
      fixtureId,
    },
  });

  revalidatePath("/picks");
  revalidatePath("/history");
  return { ok: true };
}

export async function adminOverridePick(
  playerSeasonId: string,
  gameweek: number,
  clubId: string,
  fixtureId: string,
): Promise<SubmitPickResult> {
  const admin = await getCurrentPlayer();
  if (!admin?.isCommissioner) return { ok: false, error: "Only the commissioner can override picks." };

  const season = await getCurrentSeason();
  try {
    await validatePick({
      seasonId: season.id,
      playerSeasonId,
      gameweek,
      clubId,
      fixtureId,
      isAdminOverride: true,
    });
  } catch (err) {
    if (err instanceof PickValidationError) return { ok: false, error: err.message };
    throw err;
  }

  await prisma.pick.upsert({
    where: { playerSeasonId_gameweek: { playerSeasonId, gameweek } },
    update: { clubId, fixtureId, updatedByAdmin: true, result: null, points: null },
    create: {
      seasonId: season.id,
      playerSeasonId,
      gameweek,
      clubId,
      fixtureId,
      updatedByAdmin: true,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/picks");
  revalidatePath("/history");
  return { ok: true };
}
