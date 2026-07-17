import { z } from "zod";

const packageSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(100),
  token_amount: z.preprocess((v) => (v === "" || v === undefined || v === null ? 0 : Number(v)), z.number().int().min(0)),
  price: z.preprocess((v) => (v === "" || v === undefined || v === null ? 0 : Number(v)), z.number().min(0)),
  description: z.string().max(500).optional().nullable(),
  is_active: z.boolean().optional(),
  sort_order: z.preprocess((v) => (v === "" || v === undefined || v === null ? undefined : Number(v)), z.number().int().optional()),
});

function test() {
  const body = {
    id: 1, // Integer ID returned from PostgreSQL / Payload
    name: "Paket 50 Token",
    token_amount: 50,
    price: 25000,
    description: "Deskripsi",
    is_active: true,
  };

  const parsed = packageSchema.safeParse(body);
  console.log("Validation result:", parsed.success);
  if (!parsed.success) {
    console.log("Errors:", parsed.error.issues);
  }
}

test();
