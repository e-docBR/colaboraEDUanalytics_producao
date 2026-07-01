import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanDuplicates() {
  const uploads = await prisma.upload.findMany({
    orderBy: { createdAt: 'desc' }
  });

  const seen = new Set<string>();
  let deletedCount = 0;

  for (const upload of uploads) {
    if (seen.has(upload.originalName)) {
      console.log(`Deleting duplicate upload: ${upload.originalName} (ID: ${upload.id})`);
      await prisma.upload.delete({ where: { id: upload.id } });
      deletedCount++;
    } else {
      seen.add(upload.originalName);
    }
  }

  console.log(`Finished cleaning. Deleted ${deletedCount} duplicate uploads.`);
}

cleanDuplicates().catch(console.error).finally(() => prisma.$disconnect());
