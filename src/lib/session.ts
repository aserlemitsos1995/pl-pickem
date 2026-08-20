import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "pl_pickem_player";

/** No passwords: the cookie just remembers which player slug you identified as. */
export async function getCurrentPlayerSlug(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value ?? null;
}

export async function setCurrentPlayerSlug(slug: string) {
  const store = await cookies();
  store.set(COOKIE_NAME, slug, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
}

export async function clearCurrentPlayerSlug() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getCurrentPlayer() {
  const slug = await getCurrentPlayerSlug();
  if (!slug) return null;
  return prisma.player.findUnique({ where: { slug } });
}

/** The current player's PlayerSeason row for a given season, if they're rostered in it. */
export async function getCurrentPlayerSeason(seasonId: string) {
  const player = await getCurrentPlayer();
  if (!player) return null;
  const playerSeason = await prisma.playerSeason.findUnique({
    where: { seasonId_playerId: { seasonId, playerId: player.id } },
  });
  if (!playerSeason) return null;
  return { player, playerSeason };
}
