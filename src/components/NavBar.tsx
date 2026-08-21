import Link from "next/link";
import { getCurrentPlayer, getCurrentPlayerSeason } from "@/lib/session";
import { getCurrentSeason } from "@/lib/season";
import { signOutIdentity } from "@/app/identity/actions";

export default async function NavBar() {
  const player = await getCurrentPlayer();
  const season = await getCurrentSeason();
  const identity = player ? await getCurrentPlayerSeason(season.id) : null;

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 px-4 py-3 sm:flex-row sm:justify-between">
        <Link href="/picks" className="font-bold text-purple-700">
          PL Pick&apos;Em
        </Link>
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm font-medium text-gray-600">
          <Link href="/picks" className="hover:text-purple-700">
            Make Pick
          </Link>
          <Link href="/table" className="hover:text-purple-700">
            League Table
          </Link>
          <Link href="/history" className="hover:text-purple-700">
            History
          </Link>
          <Link href="/rules" className="hover:text-purple-700">
            Rules
          </Link>
          {player ? (
            <form action={signOutIdentity}>
              <button type="submit" className="max-w-[10rem] truncate text-gray-400 hover:text-purple-700">
                {identity?.playerSeason.teamName ?? player.slug} · switch
              </button>
            </form>
          ) : (
            <Link href="/identity" className="hover:text-purple-700">
              Identify yourself
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
