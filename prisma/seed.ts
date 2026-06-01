import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";

dotenv.config();

const url =
  process.env.DATABASE_URL ||
  process.env.PRISMA_DATABASE_URL ||
  process.env.POSTGRES_URL;
if (!url) {
  console.error("No DATABASE_URL found");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: url });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding HL Interns...");

  // Clear existing data
  await prisma.completion.deleteMany();
  await prisma.taskAssignment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.taskCategory.deleteMany();
  await prisma.intern.deleteMany();
  await prisma.chatLog.deleteMany();

  // Create interns
  const intern1 = await prisma.intern.create({
    data: { name: "Intern 1", sortOrder: 0 },
  });
  const intern2 = await prisma.intern.create({
    data: { name: "Intern 2", sortOrder: 1 },
  });

  console.log(`Created interns: ${intern1.name}, ${intern2.name}`);

  // Create categories
  const categories = await Promise.all([
    prisma.taskCategory.create({
      data: { name: "Operations", color: "#78716c", sortOrder: 0 },
    }),
    prisma.taskCategory.create({
      data: { name: "Learning", color: "#0ea5e9", sortOrder: 1 },
    }),
    prisma.taskCategory.create({
      data: { name: "Content", color: "#f43f5e", sortOrder: 2 },
    }),
    prisma.taskCategory.create({
      data: { name: "Outreach", color: "#f59e0b", sortOrder: 3 },
    }),
    prisma.taskCategory.create({
      data: { name: "Hospitality", color: "#10b981", sortOrder: 4 },
    }),
  ]);

  const catMap: Record<string, string> = {};
  for (const c of categories) {
    catMap[c.name] = c.id;
  }

  console.log(`Created ${categories.length} categories`);

  // Create tasks
  const tasks = [
    {
      title: "Attend 2 HighLife / partner shows",
      description: "Go to live shows, network, represent HighLife",
      categoryId: catMap["Learning"],
      frequency: "Monthly" as const,
      target: 2,
      unit: "shows",
      sortOrder: 0,
    },
    {
      title: "Scrape competitor Instagrams (top 5 DMV studios)",
      description: "Weekly audit of competitor content, engagement, and strategy",
      categoryId: catMap["Outreach"],
      frequency: "Weekly" as const,
      target: 1,
      unit: "report",
      sortOrder: 1,
    },
    {
      title: "Sit in on 3 studio sessions",
      description: "Observe recording sessions, learn workflow and etiquette",
      categoryId: catMap["Learning"],
      frequency: "Weekly" as const,
      target: 3,
      unit: "sessions",
      sortOrder: 2,
    },
    {
      title: "Deep clean studio",
      description: "Full wipe-down of all surfaces, equipment, and common areas",
      categoryId: catMap["Hospitality"],
      frequency: "Weekly" as const,
      target: 2,
      unit: "cleans",
      sortOrder: 3,
    },
    {
      title: "Schedule weekly teaching session with James or JoJo",
      description: "1-on-1 mentorship covering audio, business, or content",
      categoryId: catMap["Learning"],
      frequency: "Weekly" as const,
      target: 1,
      unit: "session",
      sortOrder: 4,
    },
    {
      title: "Submit Friday progress report (loom or text)",
      description: "End-of-week summary of what was done, learned, and blocked",
      categoryId: catMap["Operations"],
      frequency: "Weekly" as const,
      target: 1,
      unit: "report",
      sortOrder: 5,
    },
    {
      title: "Capture content during sessions (5 photo/video clips minimum)",
      description: "Behind-the-scenes content for social media pipeline",
      categoryId: catMap["Content"],
      frequency: "Weekly" as const,
      target: 5,
      unit: "clips",
      sortOrder: 6,
    },
    {
      title: "Tag HighLife in 3 social posts",
      description: "Personal posts mentioning or tagging HighLife accounts",
      categoryId: catMap["Content"],
      frequency: "Weekly" as const,
      target: 3,
      unit: "posts",
      sortOrder: 7,
    },
    {
      title: "Reach out to 5 new podcast prospects",
      description: "Cold outreach via DM or email to potential podcast guests",
      categoryId: catMap["Outreach"],
      frequency: "Weekly" as const,
      target: 5,
      unit: "outreach",
      sortOrder: 8,
    },
    {
      title: "Help with podcast setup + breakdown",
      description: "Mic placement, lighting, cable management, post-session cleanup",
      categoryId: catMap["Hospitality"],
      frequency: "Weekly" as const,
      target: 3,
      unit: "sessions",
      sortOrder: 9,
    },
    {
      title: "Complete one training module (audio basics, mic technique, etc.)",
      description: "Self-paced learning from assigned curriculum",
      categoryId: catMap["Learning"],
      frequency: "Monthly" as const,
      target: 1,
      unit: "module",
      sortOrder: 10,
    },
    {
      title: "Attend monthly all-hands with JoJo + James",
      description: "Team sync to review progress, set goals, and align priorities",
      categoryId: catMap["Operations"],
      frequency: "Monthly" as const,
      target: 1,
      unit: "meeting",
      sortOrder: 11,
    },
  ];

  const createdTasks = await Promise.all(
    tasks.map((t) => prisma.task.create({ data: t }))
  );

  console.log(`Created ${createdTasks.length} tasks`);

  // Assign all tasks to both interns by default
  const assignments = [];
  for (const task of createdTasks) {
    assignments.push(
      prisma.taskAssignment.create({
        data: { taskId: task.id, internId: intern1.id },
      }),
      prisma.taskAssignment.create({
        data: { taskId: task.id, internId: intern2.id },
      })
    );
  }
  await Promise.all(assignments);

  console.log(`Created ${assignments.length} task assignments`);
  console.log("Seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
