export default function RulesPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-xl font-bold">Rules</h1>
      <p className="mt-1 text-sm text-gray-500">Everything you need to know about how the pick&apos;em works.</p>

      <div className="mt-6 space-y-6">
        <Section title="1. The Basics">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Each gameweek, pick one Premier League club you think will win — or at least not lose.</li>
            <li>
              <span className="font-medium">Win</span> = 3 points, <span className="font-medium">Tie</span> = 1 point,{" "}
              <span className="font-medium">Loss</span> = 0 points, <span className="font-medium">Did Not Pick (DNP)</span> = 0
              points.
            </li>
            <li>The league table ranks everyone by total points. There&apos;s currently no tiebreaker — if two teams finish level on points, they&apos;re shown level in the table.</li>
          </ul>
        </Section>

        <Section title="2. Pick Restrictions">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <span className="font-medium">A fresh club every week, twice a season.</span> The season is split into two
              halves — gameweeks 1 through 19, and gameweeks 20 through 38. Within each half, you must pick a different club
              every gameweek; once you&apos;ve used a club in that half, it&apos;s unavailable again until the next half
              begins. When gameweek 20 arrives, the slate resets and every club becomes available again, so you build a
              second complete set of unique picks across gameweeks 20–38.
            </li>
            <li>
              <span className="font-medium">Opponent cap.</span> Across the entire season (both halves combined), you can&apos;t
              pick against the same club more than 4 times.
            </li>
            <li>
              <span className="font-medium">Deadline.</span> Picks lock the moment that match kicks off — no changes after.
            </li>
          </ul>
        </Section>

        <Section title="3. Visibility">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Your own pick is visible to you the moment you make it.</li>
            <li>
              Everyone else&apos;s pick for a match that hasn&apos;t kicked off yet stays hidden until kickoff — so nobody
              can copy your pick or react to it before the match starts. Once the match kicks off, it&apos;s visible to
              everyone on the History page.
            </li>
          </ul>
        </Section>

        <Section title="4. Missed Picks">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              If you don&apos;t submit a pick for a gameweek, it&apos;s recorded as a <span className="font-medium">DNP</span>{" "}
              — 0 points, and it does not count against your half-repeat or opponent-cap limits.
            </li>
          </ul>
        </Section>

        <Section title="5. Postponed or Cancelled Matches">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              If a match gets postponed, it still belongs to its original gameweek — the deadline simply moves to the new
              kickoff time, and the result is credited once the match is eventually played.
            </li>
            <li>If a match is cancelled outright and never replayed, any pick made against it is scored as a DNP — 0 points.</li>
          </ul>
        </Section>

        <Section title="6. Commissioner Overrides">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              The commissioner can enter a pick on a player&apos;s behalf, including after kickoff in special cases. The
              half-repeat and opponent-cap rules still apply to overrides just like any other pick.
            </li>
          </ul>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
      <div className="mt-2 text-sm text-gray-600">{children}</div>
    </div>
  );
}
