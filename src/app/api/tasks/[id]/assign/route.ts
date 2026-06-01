import { requirePrisma } from "@/lib/db";
import { NextRequest } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const prisma = requirePrisma();
  const { id: taskId } = await params;
  const body = await request.json();

  // Check if assignment already exists
  const existing = await prisma.taskAssignment.findUnique({
    where: { taskId_internId: { taskId, internId: body.internId } },
  });

  if (existing) {
    return Response.json({ ok: true, message: "Already assigned" });
  }

  const assignment = await prisma.taskAssignment.create({
    data: { taskId, internId: body.internId },
  });

  return Response.json(assignment, { status: 201 });
}
