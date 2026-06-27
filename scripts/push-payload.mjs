import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// Set the PAYLOAD_CONFIG_PATH env
process.env.PAYLOAD_CONFIG_PATH = resolve(__dirname, "..", "payload.config.ts");

// Dynamically import the payload push
const { push } = await import("payload/dist/bin/push.js");
await push();
