import { requirePrisma } from "@/lib/db";

export async function POST(request: Request) {
  const prisma = requirePrisma();
  const body = await request.json();

  const maxSort = await prisma.intern.aggregate({
    _max: { sortOrder: true },
  });

  const intern = await prisma.intern.create({
    data: {
      name: body.name || "New Intern",
      notes: body.notes || "",
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
    },
  });

  return Response.json(intern, { status: 201 });
}
