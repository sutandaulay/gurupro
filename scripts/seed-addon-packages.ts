import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seedAddonPackages() {
  console.log("Seeding addon poin packages...\n");

  try {
    const existing = await prisma.addon_token_packages.findMany({});
    if (existing.length > 0) {
      console.log("Addon packages already exist, skipping seed.\n");
      return;
    }

    const packages = [
      {
        name: "Paket 50 Poin",
        poin_amount: 50,
        price: 25000,
        description: "Poin eceran untuk kebutuhan sesekali",
        sort_order: 1,
        is_active: true,
      },
      {
        name: "Paket 100 Poin",
        poin_amount: 100,
        price: 45000,
        description: "Poin eceran dengan nilai lebih hemat",
        sort_order: 2,
        is_active: true,
      },
      {
        name: "Paket 250 Poin",
        poin_amount: 250,
        price: 95000,
        description: "Poin eceran untuk kebutuhan intensif",
        sort_order: 3,
        is_active: true,
      },
    ];

    for (const pkg of packages) {
      const created = await prisma.addon_token_packages.create({
        data: pkg,
      });
      console.log(`Created: ${created.name} - ${created.poin_amount} poin @ Rp${created.price}`);
    }

    console.log("\nSeed complete!\n");
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedAddonPackages();
