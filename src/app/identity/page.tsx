import { prisma } from "@/lib/prisma";
import { getCurrentSeason } from "@/lib/season";
import { chooseIdentity } from "./actions";

export default async function IdentityPage() {
  const season = await getCurrentSeason();
  const playerSeasons = await prisma.playerSeason.findMany({
    where: { seasonId: season.id, active: true },
    include: { player: true },
    orderBy: { teamName: "asc" },
  });

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-bold text-center">Who are you?</h1>
      <p className="mt-2 text-center text-sm text-gray-500">
        No password needed — just pick your team for the {season.label} season.
      </p>
      <div className="mt-8 flex flex-col gap-3">
        {playerSeasons.map((ps) => (
          <form key={ps.id} action={async () => { "use server"; await chooseIdentity(ps.player.slug); }}>
            <button
              type="submit"
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-left shadow-sm transition hover:border-purple-500 hover:shadow-md"
            >
              <span className="block font-semibold">{ps.teamName}</span>
              <span className="block text-sm text-gray-500">{ps.managerName}</span>
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
