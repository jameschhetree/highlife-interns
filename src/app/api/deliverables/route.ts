import { requirePrisma } from "@/lib/db";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const prisma = requirePrisma();
  const internId = request.nextUrl.searchParams.get("internId");
  const weekKey = request.nextUrl.searchParams.get("weekKey");

  if (!internId || !weekKey) {
    return Response.json({ error: "internId and weekKey required" }, { status: 400 });
  }

  const completions = await prisma.deliverableCompletion.findMany({
    where: { internId, weekKey },
  });

  const state: Record<string, { done: boolean; notes: string }> = {};
  for (const c of completions) {
    state[c.deliverableId] = { done: c.done, notes: c.notes };
  }

  return Response.json(state);
}

export async function POST(request: NextRequest) {
  const prisma = requirePrisma();
  const body = await request.json();
  const { internId, weekKey, deliverableId, done, notes } = body;

  if (!internId || !weekKey || !deliverableId) {
    return Response.json({ error: "internId, weekKey, deliverableId required" }, { status: 400 });
  }

  const completion = await prisma.deliverableCompletion.upsert({
    where: {
      internId_deliverableId_weekKey: { internId, deliverableId, weekKey },
    },
    update: { done: done ?? false, notes: notes ?? "" },
    create: { internId, deliverableId, weekKey, done: done ?? false, notes: notes ?? "" },
  });

  return Response.json(completion);
}
