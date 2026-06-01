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
  if (body.title !== undefined) data.title = body.title;
  if (body.description !== undefined) data.description = body.description;
  if (body.categoryId !== undefined) data.categoryId = body.categoryId;
  if (body.frequency !== undefined) data.frequency = body.frequency;
  if (body.target !== undefined) data.target = body.target;
  if (body.unit !== undefined) data.unit = body.unit;
  if (body.done !== undefined) data.done = body.done;
  if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder;

  const task = await prisma.task.update({
    where: { id },
    data,
    include: { assignments: true, completions: true },
  });

  return Response.json(task);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const prisma = requirePrisma();
  const { id } = await params;

  await prisma.task.delete({ where: { id } });
  return Response.json({ ok: true });
}
