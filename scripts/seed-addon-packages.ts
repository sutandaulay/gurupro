import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seedAddonPackages() {
  console.log("Seeding addon token packages...\n");

  try {
    const existing = await prisma.addon_token_packages.findMany({});
    if (existing.length > 0) {
      console.log("Addon packages already exist, skipping seed.\n");
      return;
    }

    const packages = [
      {
        name: "20 Token",
        token_amount: 20,
        price: 15000,
        description: "Paket 20 token untuk penggunaan fitur AI",
        sort_order: 1,
        is_active: true,
      },
      {
        name: "50 Token",
        token_amount: 50,
        price: 30000,
        description: "Paket 50 token dengan harga lebih hemat",
        sort_order: 2,
        is_active: true,
      },
      {
        name: "100 Token",
        token_amount: 100,
        price: 40000,
        description: "Paket 100 token - best value!",
        sort_order: 3,
        is_active: true,
      },
    ];

    for (const pkg of packages) {
      const created = await prisma.addon_token_packages.create({
        data: pkg,
      });
      console.log(`Created: ${created.name} - ${created.token_amount} tokens @ Rp${created.price}`);
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
