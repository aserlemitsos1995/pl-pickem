import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getAllSeasons, getCurrentSeason } from "@/lib/season";

export default async function TablePage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const { season: seasonLabel } = await searchParams;
  const seasons = await getAllSeasons();
  const current = await getCurrentSeason();
  const season = seasonLabel ? seasons.find((s) => s.label === seasonLabel) ?? current : current;

  const playerSeasons = await prisma.playerSeason.findMany({
    where: { seasonId: season.id },
    include: { picks: true },
  });

  const rows = playerSeasons
    .map((ps) => {
      const decided = ps.picks.filter((p) => p.points !== null);
      const wins = decided.filter((p) => p.result === "WIN").length;
      const ties = decided.filter((p) => p.result === "TIE").length;
      const losses = decided.filter((p) => p.result === "LOSS" || p.result === "DNP").length;
      const points = decided.reduce((sum, p) => sum + (p.points ?? 0), 0);
      return { teamName: ps.teamName, managerName: ps.managerName, played: decided.length, wins, ties, losses, points };
    })
    .sort((a, b) => b.points - a.points);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">League Table — {season.label}</h1>
        <div className="flex gap-2 text-sm">
          {seasons.map((s) => (
            <Link
              key={s.id}
              href={`/table?season=${s.label}`}
              className={`rounded border px-3 py-1 ${s.id === season.id ? "border-purple-600 bg-purple-600 text-white" : "hover:bg-gray-100"}`}
            >
              {s.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="text-left text-gray-600">
            <tr>
              <th className="sticky top-0 z-10 bg-gray-100 px-4 py-2">#</th>
              <th className="sticky top-0 z-10 bg-gray-100 px-4 py-2 whitespace-nowrap">Team</th>
              <th className="sticky top-0 z-10 bg-gray-100 px-4 py-2 whitespace-nowrap">Manager</th>
              <th className="sticky top-0 z-10 bg-gray-100 px-4 py-2 text-center">P</th>
              <th className="sticky top-0 z-10 bg-gray-100 px-4 py-2 text-center">W</th>
              <th className="sticky top-0 z-10 bg-gray-100 px-4 py-2 text-center">T</th>
              <th className="sticky top-0 z-10 bg-gray-100 px-4 py-2 text-center">L</th>
              <th className="sticky top-0 z-10 bg-gray-100 px-4 py-2 text-right">Pts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.teamName} className="border-t border-gray-100">
                <td className="px-4 py-2 text-gray-400">{i + 1}</td>
                <td className="px-4 py-2 font-medium whitespace-nowrap">{r.teamName}</td>
                <td className="px-4 py-2 whitespace-nowrap text-gray-500">{r.managerName}</td>
                <td className="px-4 py-2 text-center">{r.played}</td>
                <td className="px-4 py-2 text-center">{r.wins}</td>
                <td className="px-4 py-2 text-center">{r.ties}</td>
                <td className="px-4 py-2 text-center">{r.losses}</td>
                <td className="px-4 py-2 text-right font-bold">{r.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
