import config from "../payload.config";

console.log("SUCCESS: Payload config loaded successfully!");
console.log("Collections:", config.collections?.map(c => c.slug));
console.log("Globals:", config.globals?.map(g => g.slug));
process.exit(0);
