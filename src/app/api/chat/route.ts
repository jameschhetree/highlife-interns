import { requirePrisma } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 30;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface ActionParam {
  type: string;
  params: Record<string, unknown>;
}

export async function GET() {
  const prisma = requirePrisma();
  const logs = await prisma.chatLog.findMany({
    orderBy: { createdAt: "asc" },
    take: 50,
  });
  return Response.json(logs);
}

export async function POST(request: Request) {
  const prisma = requirePrisma();
  const { message } = await request.json();

  if (!message || typeof message !== "string") {
    return Response.json({ error: "Message required" }, { status: 400 });
  }

  await prisma.chatLog.create({
    data: { role: "user", content: message },
  });

  // Get current state
  const [interns, categories] = await Promise.all([
    prisma.intern.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.taskCategory.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        tasks: {
          orderBy: { sortOrder: "asc" },
          include: {
            assignments: {
              include: { intern: { select: { id: true, name: true } } },
            },
          },
        },
      },
    }),
  ]);

  const stateJson = JSON.stringify(
    {
      interns: interns.map((i) => ({
        id: i.id,
        name: i.name,
        active: i.active,
      })),
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        tasks: c.tasks.map((t) => ({
          id: t.id,
          title: t.title,
          frequency: t.frequency,
          target: t.target,
          unit: t.unit,
          assignedTo: t.assignments.map((a) => a.intern.name),
        })),
      })),
    },
    null,
    1
  );

  const systemPrompt = `You are the HighLife Interns task manager. You help manage intern accountability for a recording/podcast studio in Washington DC.

CURRENT STATE:
${stateJson}

You can perform actions. Return a JSON object with:
- "reply": a short, human-readable response
- "actions": an array of action objects

Available actions:
- {"type":"add_task","params":{"title":"...","categoryId":"<id>","frequency":"Weekly|Monthly|Daily|Quarterly|OneTime","target":1,"unit":"..."}}
- {"type":"update_task","params":{"id":"<id>","title":"...","target":1,"unit":"...","frequency":"..."}}
- {"type":"delete_task","params":{"id":"<id>"}}
- {"type":"add_intern","params":{"name":"..."}}
- {"type":"remove_intern","params":{"id":"<id>"}}
- {"type":"assign","params":{"taskId":"<id>","internId":"<id>"}}
- {"type":"unassign","params":{"taskId":"<id>","internId":"<id>"}}
- {"type":"mark_complete","params":{"taskId":"<id>","internId":"<id>"}}

If the user asks a question, return actions: [] and provide the answer in reply.

IMPORTANT: Always respond with valid JSON only. No markdown wrapping.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: message }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    let parsed: { reply: string; actions: ActionParam[] };
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = jsonMatch
        ? JSON.parse(jsonMatch[0])
        : { reply: text, actions: [] };
    } catch {
      parsed = { reply: text, actions: [] };
    }

    const applied: string[] = [];
    for (const action of parsed.actions || []) {
      try {
        switch (action.type) {
          case "add_task": {
            const p = action.params;
            const maxSort = await prisma.task.aggregate({
              where: { categoryId: p.categoryId as string },
              _max: { sortOrder: true },
            });
            await prisma.task.create({
              data: {
                title: (p.title as string) || "New Task",
                categoryId: p.categoryId as string,
                frequency: (p.frequency as string as "Weekly") || "Weekly",
                target: (p.target as number) || 1,
                unit: (p.unit as string) || "tasks",
                sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
              },
            });
            applied.push(`Added task: ${p.title}`);
            break;
          }
          case "update_task": {
            const p = action.params;
            const data: Record<string, unknown> = {};
            if (p.title !== undefined) data.title = p.title;
            if (p.target !== undefined) data.target = p.target;
            if (p.unit !== undefined) data.unit = p.unit;
            if (p.frequency !== undefined) data.frequency = p.frequency;
            if (p.categoryId !== undefined) data.categoryId = p.categoryId;
            await prisma.task.update({ where: { id: p.id as string }, data });
            applied.push(`Updated task ${p.id}`);
            break;
          }
          case "delete_task": {
            await prisma.task.delete({
              where: { id: action.params.id as string },
            });
            applied.push(`Deleted task ${action.params.id}`);
            break;
          }
          case "add_intern": {
            const p = action.params;
            const maxSort = await prisma.intern.aggregate({
              _max: { sortOrder: true },
            });
            await prisma.intern.create({
              data: {
                name: (p.name as string) || "New Intern",
                sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
              },
            });
            applied.push(`Added intern: ${p.name}`);
            break;
          }
          case "remove_intern": {
            await prisma.intern.delete({
              where: { id: action.params.id as string },
            });
            applied.push(`Removed intern ${action.params.id}`);
            break;
          }
          case "assign": {
            const p = action.params;
            await prisma.taskAssignment.create({
              data: {
                taskId: p.taskId as string,
                internId: p.internId as string,
              },
            });
            applied.push(`Assigned task ${p.taskId} to intern ${p.internId}`);
            break;
          }
          case "unassign": {
            const p = action.params;
            await prisma.taskAssignment.delete({
              where: {
                taskId_internId: {
                  taskId: p.taskId as string,
                  internId: p.internId as string,
                },
              },
            });
            applied.push(`Unassigned task ${p.taskId} from intern ${p.internId}`);
            break;
          }
          case "mark_complete": {
            const p = action.params;
            await prisma.completion.create({
              data: {
                taskId: p.taskId as string,
                internId: p.internId as string,
              },
            });
            applied.push(`Marked completion for task ${p.taskId}`);
            break;
          }
        }
      } catch (err) {
        applied.push(
          `Failed: ${action.type} - ${err instanceof Error ? err.message : "unknown error"}`
        );
      }
    }

    const assistantContent =
      parsed.reply +
      (applied.length > 0 ? `\n\nActions applied: ${applied.join(", ")}` : "");

    await prisma.chatLog.create({
      data: { role: "assistant", content: assistantContent },
    });

    return Response.json({
      reply: assistantContent,
      actions: parsed.actions || [],
      applied,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Claude API error";
    return Response.json({ error: errMsg }, { status: 500 });
  }
}
