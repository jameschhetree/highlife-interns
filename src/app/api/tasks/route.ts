import { requirePrisma } from "@/lib/db";

export async function POST(request: Request) {
  const prisma = requirePrisma();
  const body = await request.json();

  const maxSort = await prisma.task.aggregate({
    where: { categoryId: body.categoryId },
    _max: { sortOrder: true },
  });

  const task = await prisma.task.create({
    data: {
      title: body.title || "New Task",
      description: body.description || "",
      categoryId: body.categoryId,
      frequency: body.frequency || "Weekly",
      target: body.target || 1,
      unit: body.unit || "tasks",
      done: false,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
    },
    include: { assignments: true, completions: true },
  });

  return Response.json(task, { status: 201 });
}
