import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSeason, getDefaultGameweek } from "@/lib/season";
import { getCurrentPlayerSeason } from "@/lib/session";
import { getGameweekBoard } from "@/lib/picks";
import PickBoard from "./PickBoard";

export default async function PicksPage({
  searchParams,
}: {
  searchParams: Promise<{ gw?: string }>;
}) {
  const season = await getCurrentSeason();
  const identity = await getCurrentPlayerSeason(season.id);
  if (!identity) redirect("/identity");

  const { gw } = await searchParams;
  const defaultGw = await getDefaultGameweek(season.id);
  const gameweek = Math.min(Math.max(Number(gw) || defaultGw, 1), season.totalGameweeks);

  const board = await getGameweekBoard(identity.playerSeason.id, season.id, gameweek);
  const half = gameweek < season.secondHalfStartsAt ? 1 : 2;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">
            Gameweek {gameweek} <span className="text-sm font-normal text-gray-400">(half {half})</span>
          </h1>
          <p className="text-sm text-gray-500">{identity.playerSeason.teamName}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/picks?gw=${gameweek - 1}`}
            className={`rounded border px-3 py-1 text-sm ${gameweek <= 1 ? "pointer-events-none text-gray-300" : "hover:bg-gray-100"}`}
          >
            &larr; Prev
          </Link>
          <Link
            href={`/picks?gw=${gameweek + 1}`}
            className={`rounded border px-3 py-1 text-sm ${gameweek >= season.totalGameweeks ? "pointer-events-none text-gray-300" : "hover:bg-gray-100"}`}
          >
            Next &rarr;
          </Link>
        </div>
      </div>

      <div className="mt-6">
        <PickBoard gameweek={gameweek} fixtures={board.fixtures} />
      </div>
    </div>
  );
}
