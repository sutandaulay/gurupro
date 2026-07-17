import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local" });

import { getPayload } from "payload";
import config from "../payload.config";

async function main() {
  console.log("🚀 Initializing Payload (push schema: users, institutions, etc)...");
  const payload = await getPayload({ config });
  console.log("✅ Payload initialized");

  // Quick sanity check that users collection exists
  try {
    const res = await payload.find({ collection: "users", limit: 1 });
    console.log(`• users collection reachable, docs: ${res.docs.length}`);
  } catch (e) {
    console.warn("⚠️ users query warning:", (e as Error).message);
  }

  console.log("🎉 Payload schema pushed.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("❌ FAILED:", e);
    process.exit(1);
  });
