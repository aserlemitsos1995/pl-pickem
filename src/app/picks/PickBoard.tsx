"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { FixtureBoardRow } from "@/lib/picks";
import { submitPick } from "./actions";

function formatKickoff(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function PickBoard({ gameweek, fixtures }: { gameweek: number; fixtures: FixtureBoardRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pendingClubId, setPendingClubId] = useState<string | null>(null);

  function pick(clubId: string, fixtureId: string) {
    setError(null);
    setPendingClubId(clubId);
    startTransition(async () => {
      const res = await submitPick(gameweek, clubId, fixtureId);
      setPendingClubId(null);
      if (!res.ok) {
        setError(res.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700 border border-red-200">{error}</div>
      )}
      {fixtures.map((f) => (
        <div
          key={f.fixtureId}
          className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm"
        >
          <div className="w-40 shrink-0 text-xs text-gray-500">
            {formatKickoff(f.kickoff)}
            {f.locked && <div className="font-medium text-gray-400">Locked</div>}
          </div>
          <div className="flex flex-1 items-center justify-center gap-3">
            <ClubButton option={f.home} loading={pending && pendingClubId === f.home.clubId} onPick={() => pick(f.home.clubId, f.fixtureId)} />
            <span className="text-xs text-gray-400">vs</span>
            <ClubButton option={f.away} loading={pending && pendingClubId === f.away.clubId} onPick={() => pick(f.away.clubId, f.fixtureId)} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ClubButton({
  option,
  loading,
  onPick,
}: {
  option: FixtureBoardRow["home"];
  loading: boolean;
  onPick: () => void;
}) {
  const base = "flex-1 rounded-md border px-3 py-2 text-sm font-medium transition min-w-[9rem] text-center";
  const state = option.isCurrentPick
    ? "border-purple-600 bg-purple-600 text-white"
    : option.disabled
      ? "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed"
      : "border-gray-300 bg-white hover:border-purple-500 hover:bg-purple-50";

  return (
    <button
      type="button"
      disabled={option.disabled || loading}
      onClick={onPick}
      title={option.disabledReason ?? undefined}
      className={`${base} ${state}`}
    >
      {option.name}
      {option.isCurrentPick && <span className="block text-[11px] font-normal opacity-80">your pick</span>}
      {!option.isCurrentPick && option.disabled && (
        <span className="block text-[11px] font-normal">{option.disabledReason}</span>
      )}
    </button>
  );
}
