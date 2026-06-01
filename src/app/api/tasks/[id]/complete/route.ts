import { requirePrisma } from "@/lib/db";
import { NextRequest } from "next/server";

/**
 * POST /api/tasks/[id]/complete
 * Body: { internId: string }
 * Query: ?week=YYYY-MM-DD  (optional, backdates to that Sunday 23:59:59)
 *
 * If ?week is provided, completedAt = that week's Sunday at 23:59:59
 * Otherwise, completedAt = now (default Prisma behavior)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const prisma = requirePrisma();
  const { id: taskId } = await params;
  const body = await request.json();
  const weekParam = request.nextUrl.searchParams.get("week");

  let completedAt: Date | undefined;

  if (weekParam) {
    // Parse YYYY-MM-DD, find that week's Monday, then Sunday 23:59:59
    const [y, m, d] = weekParam.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const dayOfWeek = date.getDay();
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(date);
    monday.setDate(monday.getDate() - diff);
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    completedAt = sunday;
  }

  const completion = await prisma.completion.create({
    data: {
      taskId,
      internId: body.internId,
      ...(completedAt ? { completedAt } : {}),
    },
  });

  return Response.json(completion, { status: 201 });
}
