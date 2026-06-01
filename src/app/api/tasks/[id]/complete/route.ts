import { requirePrisma } from "@/lib/db";
import { NextRequest } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const prisma = requirePrisma();
  const { id: taskId } = await params;
  const body = await request.json();

  const completion = await prisma.completion.create({
    data: {
      taskId,
      internId: body.internId,
    },
  });

  return Response.json(completion, { status: 201 });
}
