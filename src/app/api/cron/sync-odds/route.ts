import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncOdds } from "@/lib/sync";

// Vercel Cron automatically sends `Authorization: Bearer $CRON_SECRET` on
// scheduled invocations; this rejects any other caller.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const season = await prisma.season.findFirstOrThrow({ where: { isCurrent: true } });
  const updated = await syncOdds(season.id);
  return NextResponse.json({ season: season.label, updated });
}
