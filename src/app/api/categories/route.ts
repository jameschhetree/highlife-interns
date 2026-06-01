import { requirePrisma } from "@/lib/db";

export async function POST(request: Request) {
  const prisma = requirePrisma();
  const body = await request.json();

  const maxSort = await prisma.taskCategory.aggregate({
    _max: { sortOrder: true },
  });

  const category = await prisma.taskCategory.create({
    data: {
      name: body.name || "New Category",
      color: body.color || "#6b7280",
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
    },
  });

  return Response.json(category, { status: 201 });
}
