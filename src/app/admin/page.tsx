import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSeason, getDefaultGameweek } from "@/lib/season";
import { getCurrentPlayer } from "@/lib/session";
import { getGameweekBoard } from "@/lib/picks";
import AdminPickBoard from "./AdminPickBoard";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ player?: string; gw?: string }>;
}) {
  const admin = await getCurrentPlayer();
  if (!admin) redirect("/identity");
  if (!admin.isCommissioner) redirect("/picks");

  const season = await getCurrentSeason();
  const playerSeasons = await prisma.playerSeason.findMany({
    where: { seasonId: season.id },
    orderBy: { teamName: "asc" },
  });
  if (playerSeasons.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-xl font-bold">Admin</h1>
        <p className="mt-2 text-sm text-gray-500">No players are rostered for {season.label} yet.</p>
      </div>
    );
  }

  const { player: playerParam, gw } = await searchParams;
  const selected = playerSeasons.find((ps) => ps.id === playerParam) ?? playerSeasons[0];

  const defaultGw = await getDefaultGameweek(season.id);
  const gameweek = Math.min(Math.max(Number(gw) || defaultGw, 1), season.totalGameweeks);

  const board = await getGameweekBoard(selected.id, season.id, gameweek, { bypassLock: true });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-xl font-bold">Admin — Override Picks</h1>
      <p className="mt-1 text-sm text-gray-500">
        Commissioner override: bypasses the kickoff deadline. Half-repeat and opponent-cap rules still apply.
      </p>

      <div className="mt-6 flex flex-wrap gap-2 text-sm">
        {playerSeasons.map((ps) => (
          <Link
            key={ps.id}
            href={`/admin?player=${ps.id}&gw=${gameweek}`}
            className={`rounded border px-3 py-1 ${ps.id === selected.id ? "border-purple-600 bg-purple-600 text-white" : "hover:bg-gray-100"}`}
          >
            {ps.teamName}
          </Link>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-600">
          Gameweek {gameweek} — {selected.teamName}
        </h2>
        <div className="flex gap-2">
          <Link
            href={`/admin?player=${selected.id}&gw=${gameweek - 1}`}
            className={`rounded border px-3 py-1 text-sm ${gameweek <= 1 ? "pointer-events-none text-gray-300" : "hover:bg-gray-100"}`}
          >
            &larr; Prev
          </Link>
          <Link
            href={`/admin?player=${selected.id}&gw=${gameweek + 1}`}
            className={`rounded border px-3 py-1 text-sm ${gameweek >= season.totalGameweeks ? "pointer-events-none text-gray-300" : "hover:bg-gray-100"}`}
          >
            Next &rarr;
          </Link>
        </div>
      </div>

      <div className="mt-4">
        <AdminPickBoard playerSeasonId={selected.id} gameweek={gameweek} fixtures={board.fixtures} />
      </div>
    </div>
  );
}
