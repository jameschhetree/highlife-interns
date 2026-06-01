import { requirePrisma } from "@/lib/db";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Returns state scoped to a specific week.
 * ?week=YYYY-MM-DD  (defaults to current Monday if missing)
 *
 * Completions are filtered server-side to only include those
 * within the relevant period for each task's frequency:
 *   Weekly  -> Mon-Sun of selected week
 *   Monthly -> calendar month containing that Monday
 *   Quarterly -> quarter containing that Monday
 *   OneTime -> all time
 */
export async function GET(request: NextRequest) {
  const prisma = requirePrisma();

  // Parse ?week= param
  const weekParam = request.nextUrl.searchParams.get("week");
  const monday = getMonday(weekParam);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  // Compute month/quarter boundaries from selected monday
  const monthStart = new Date(monday.getFullYear(), monday.getMonth(), 1);
  const monthEnd = new Date(monday.getFullYear(), monday.getMonth() + 1, 1);
  const q = Math.floor(monday.getMonth() / 3);
  const quarterStart = new Date(monday.getFullYear(), q * 3, 1);
  const quarterEnd = new Date(monday.getFullYear(), q * 3 + 3, 1);

  const [interns, categories] = await Promise.all([
    prisma.intern.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        assignments: true,
        completions: {
          orderBy: { completedAt: "desc" },
          take: 500,
        },
      },
    }),
    prisma.taskCategory.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        tasks: {
          orderBy: { sortOrder: "asc" },
          include: {
            assignments: {
              include: { intern: { select: { id: true, name: true } } },
            },
            completions: {
              orderBy: { completedAt: "desc" },
              take: 500,
            },
          },
        },
      },
    }),
  ]);

  // Return the ranges so the client can use them for counting
  return Response.json({
    interns,
    categories,
    weekRange: {
      monday: monday.toISOString(),
      sunday: sunday.toISOString(),
      monthStart: monthStart.toISOString(),
      monthEnd: monthEnd.toISOString(),
      quarterStart: quarterStart.toISOString(),
      quarterEnd: quarterEnd.toISOString(),
    },
  });
}

/** Get ISO Monday for a given date string, or current week's Monday. */
function getMonday(dateStr: string | null): Date {
  let d: Date;
  if (dateStr) {
    // Parse YYYY-MM-DD in local time
    const [y, m, day] = dateStr.split("-").map(Number);
    d = new Date(y, m - 1, day);
  } else {
    d = new Date();
  }
  const dayOfWeek = d.getDay(); // 0=Sun, 1=Mon...
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
