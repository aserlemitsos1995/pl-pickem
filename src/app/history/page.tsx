import Link from "next/link";
import { getAllSeasons, getCurrentSeason } from "@/lib/season";
import { getSeasonGrids } from "@/lib/picks";
import { OPPONENT_CAP } from "@/lib/game-logic";

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const { season: seasonLabel } = await searchParams;
  const seasons = await getAllSeasons();
  const current = await getCurrentSeason();
  const season = seasonLabel ? seasons.find((s) => s.label === seasonLabel) ?? current : current;

  const grid = await getSeasonGrids(season.id);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Pick History — {season.label}</h1>
        <div className="flex gap-2 text-sm">
          {seasons.map((s) => (
            <Link
              key={s.id}
              href={`/history?season=${s.label}`}
              className={`rounded border px-3 py-1 ${s.id === season.id ? "border-purple-600 bg-purple-600 text-white" : "hover:bg-gray-100"}`}
            >
              {s.label}
            </Link>
          ))}
        </div>
      </div>

      <GridSection
        title="Clubs Picked — First Half of Season"
        clubs={grid.clubs}
        players={grid.players}
        renderCell={(clubId, playerSeasonId) =>
          grid.firstHalfPicked.get(playerSeasonId)?.has(clubId) ? (
            <span className="text-green-600">✓</span>
          ) : null
        }
      />

      <GridSection
        title="Clubs Picked — Second Half of Season"
        clubs={grid.clubs}
        players={grid.players}
        renderCell={(clubId, playerSeasonId) =>
          grid.secondHalfPicked.get(playerSeasonId)?.has(clubId) ? (
            <span className="text-green-600">✓</span>
          ) : null
        }
      />

      <GridSection
        title="Picked Against — Season Total"
        clubs={grid.clubs}
        players={grid.players}
        renderCell={(clubId, playerSeasonId) => {
          const count = grid.opponentCounts.get(playerSeasonId)?.get(clubId) ?? 0;
          if (count === 0) return null;
          const atCap = count >= OPPONENT_CAP;
          return <span className={atCap ? "font-bold text-red-600" : "text-gray-700"}>{count}</span>;
        }}
      />
    </div>
  );
}

function GridSection({
  title,
  clubs,
  players,
  renderCell,
}: {
  title: string;
  clubs: { id: string; name: string }[];
  players: { playerSeasonId: string; teamName: string }[];
  renderCell: (clubId: string, playerSeasonId: string) => React.ReactNode;
}) {
  return (
    <div className="mt-8">
      <h2 className="mb-2 text-sm font-semibold text-gray-600">{title}</h2>
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left text-gray-600">
            <tr>
              <th className="sticky left-0 bg-gray-100 px-3 py-2">Club</th>
              {players.map((p) => (
                <th key={p.playerSeasonId} className="px-3 py-2 text-center whitespace-nowrap">
                  {p.teamName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {clubs.map((c) => (
              <tr key={c.id} className="border-t border-gray-100">
                <td className="sticky left-0 bg-white px-3 py-1.5 font-medium whitespace-nowrap">{c.name}</td>
                {players.map((p) => (
                  <td key={p.playerSeasonId} className="px-3 py-1.5 text-center">
                    {renderCell(c.id, p.playerSeasonId)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
