import { requirePrisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const prisma = requirePrisma();

  const [interns, categories] = await Promise.all([
    prisma.intern.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        assignments: true,
        completions: {
          orderBy: { completedAt: "desc" },
          take: 200,
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
              take: 100,
            },
          },
        },
      },
    }),
  ]);

  return Response.json({ interns, categories });
}
