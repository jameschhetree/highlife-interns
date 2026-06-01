import { requirePrisma } from "@/lib/db";
import { NextRequest } from "next/server";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; internId: string }> }
) {
  const prisma = requirePrisma();
  const { id: taskId, internId } = await params;

  await prisma.taskAssignment.delete({
    where: { taskId_internId: { taskId, internId } },
  });

  return Response.json({ ok: true });
}
