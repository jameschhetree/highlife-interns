import { requirePrisma } from "@/lib/db";
import { NextRequest } from "next/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const prisma = requirePrisma();
  const { id } = await params;
  const body = await request.json();

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.color !== undefined) data.color = body.color;
  if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder;

  const category = await prisma.taskCategory.update({
    where: { id },
    data,
  });

  return Response.json(category);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const prisma = requirePrisma();
  const { id } = await params;

  // Block delete if tasks reference this category
  const taskCount = await prisma.task.count({ where: { categoryId: id } });
  if (taskCount > 0) {
    return Response.json(
      { error: `Cannot delete category with ${taskCount} task(s). Move or delete tasks first.` },
      { status: 400 }
    );
  }

  await prisma.taskCategory.delete({ where: { id } });
  return Response.json({ ok: true });
}
