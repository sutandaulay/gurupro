import { getPayload } from "payload";
import config from "../payload.config";

async function seedInstitution() {
  console.log("Seeding institution & members...\n");

  try {
    const payload = await getPayload({ config });

    const existingInstitutions = await payload.find({
      collection: "institutions",
      limit: 1,
    });

    if (existingInstitutions.docs.length > 0) {
      console.log("Institution data already exists, skipping seed.\n");
      return;
    }

    const { docs: users } = await payload.find({
      collection: "cms-users",
      limit: 10,
    });

    if (users.length < 2) {
      console.log("Need at least 2 existing users to seed members. Skipping.\n");
      return;
    }

    const institution = await payload.create({
      collection: "institutions",
      data: {
        name: "SD Negeri Contoh GuruPRO",
        npsn: "12345678",
        jenjang: "SD",
        naungan: "Kemendikbud",
        subscriptionTier: "trial",
        academicYearActive: "2025/2026",
        approvalLayerConfig: "single",
        status: "active",
      },
    });
    console.log(`Created institution: ${institution.name} (ID: ${institution.id})`);

    const members = [
      {
        user: users[0].id,
        institution: institution.id,
        role: ["kepala_sekolah"],
        status: "active" as const,
        joinedAt: new Date().toISOString(),
      },
      {
        user: users.length > 1 ? users[1].id : users[0].id,
        institution: institution.id,
        role: ["operator"],
        status: "active" as const,
        joinedAt: new Date().toISOString(),
      },
      {
        user: users.length > 2 ? users[2].id : users[0].id,
        institution: institution.id,
        role: ["guru"],
        status: "active" as const,
        assignedMapel: [{ mapel: "Matematika" }, { mapel: "IPA" }],
        assignedKelas: [{ kelas: "4A" }, { kelas: "4B" }],
        joinedAt: new Date().toISOString(),
      },
      {
        user: users.length > 3 ? users[3].id : users[0].id,
        institution: institution.id,
        role: ["bendahara", "admin_sekolah"],
        status: "pending" as const,
      },
    ];

    for (const memberData of members) {
      const member = await payload.create({
        collection: "institution-members",
        data: memberData,
      });
      console.log(`  Member: user=${memberData.user} role=${memberData.role} status=${memberData.status} (ID: ${member.id})`);
    }

    console.log("\nSeed complete: 1 institution, 4 members created.\n");
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  }
}

seedInstitution();
