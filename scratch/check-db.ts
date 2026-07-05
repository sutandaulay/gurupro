import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  const docs = await prisma.dokumen_bukti.findMany({
    orderBy: { id: 'desc' },
    take: 5
  });
  console.log("=== DOKUMEN BUKTI ===");
  console.log(docs);

  const pelatihans = await prisma.pelatihan_guru.findMany({
    orderBy: { id: 'desc' },
    take: 5
  });
  console.log("=== PELATIHAN GURU ===");
  console.log(pelatihans);
}

check()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
