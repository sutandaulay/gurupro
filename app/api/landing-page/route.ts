import { query } from "@/lib/db";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseSessionCookie } from "@/lib/session-sign";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const session = parseSessionCookie(cookieStore.get("gurupro_session")?.value);
  if (!session) throw new Error("Unauthorized");
  if (session.role !== "admin") throw new Error("Forbidden");
}

const heroSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(255),
  subtitle: z.string().optional().nullable(),
  button_text: z.string().max(100).optional().nullable(),
  media_url: z.string().max(500).optional().nullable(),
  media_type: z.enum(["image", "video"]).optional().default("image"),
  is_active: z.boolean().optional().default(true),
  sort_order: z.number().int().optional().default(0),
});

const featureSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  icon: z.string().max(100).optional().nullable(),
  is_active: z.boolean().optional().default(true),
  sort_order: z.number().int().optional().default(0),
});

const pricingPlanSchema = z.object({
  id: z.string().uuid().optional(),
  package_name: z.enum(["Gratis", "3 Bulan", "6 Bulan", "1 Tahun"]),
  price: z.number().min(0),
  duration_days: z.number().int().positive(),
  features: z.array(z.string()),
  is_active: z.boolean().optional().default(true),
  sort_order: z.number().int().optional().default(0),
});

const faqItemSchema = z.object({
  question: z.string(),
  answer: z.string(),
});

const settingsSchema = z.object({
  hero_badge: z.string().max(255).optional().nullable(),
  youtube_url: z.string().max(500).optional().nullable(),
  cs_contact: z.string().max(100).optional().nullable(),
  cs_whatsapp: z.string().max(20).optional().nullable(),
  chatbot_active: z.boolean().optional(),
  chatbot_welcome: z.string().optional().nullable(),
  faq: z.array(faqItemSchema).optional().nullable(),
  referral_terms: z.string().optional().nullable(),
  footer_copyright: z.string().max(255).optional().nullable(),
  footer_desc: z.string().optional().nullable(),
  footer_terms: z.string().max(500).optional().nullable(),
  footer_privacy: z.string().max(500).optional().nullable(),
  footer_contact: z.string().max(255).optional().nullable(),
  min_payout_cashback: z.number().int().optional().nullable(),
  cashback_to_token_rate: z.number().int().optional().nullable(),
});

const patchSchema = z.object({
  hero: heroSchema.optional(),
  features: z.array(featureSchema).optional(),
  pricing_plans: z.array(pricingPlanSchema).optional(),
  settings: settingsSchema.optional(),
});

const SETTINGS_COLS = [
  "hero_badge", "youtube_url", "cs_contact", "cs_whatsapp",
  "chatbot_active", "chatbot_welcome", "faq", "referral_terms",
  "footer_copyright", "footer_desc", "footer_terms", "footer_privacy", "footer_contact",
  "min_payout_cashback", "cashback_to_token_rate",
];

export async function GET() {
  try {
    const [heroes, features, plans, settings] = await Promise.all([
      query("SELECT * FROM hero_sections WHERE is_active = true ORDER BY sort_order ASC, created_at ASC"),
      query("SELECT * FROM features WHERE is_active = true ORDER BY sort_order ASC, created_at ASC"),
      query("SELECT * FROM pricing_plans WHERE is_active = true ORDER BY sort_order ASC, created_at ASC"),
      query("SELECT * FROM landing_page_settings ORDER BY created_at DESC LIMIT 1"),
    ]);

    return NextResponse.json({
      hero: heroes.rows[0] ?? null,
      features: features.rows,
      pricing_plans: plans.rows,
      settings: settings.rows[0] ?? null,
    });
  } catch (error: any) {
    console.error("GET /api/landing-page error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    await verifyAdmin();

    const body = await req.json();
    const parsed = patchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { hero, features: featureList, pricing_plans: planList, settings } = parsed.data;

    if (hero) {
      const { id, ...data } = hero;
      if (id) {
        await query(
          `UPDATE hero_sections SET title = $1, subtitle = $2, button_text = $3, media_url = $4, media_type = $5, is_active = $6, sort_order = $7, updated_at = NOW() WHERE id = $8`,
          [data.title, data.subtitle, data.button_text, data.media_url, data.media_type, data.is_active, data.sort_order, id]
        );
      } else {
        await query(
          `INSERT INTO hero_sections (title, subtitle, button_text, media_url, media_type, is_active, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [data.title, data.subtitle, data.button_text, data.media_url, data.media_type, data.is_active, data.sort_order]
        );
      }
    }

    if (featureList) {
      await query("DELETE FROM features", []);
      for (const feat of featureList) {
        const { id, ...data } = feat;
        await query(
          `INSERT INTO features (title, description, icon, is_active, sort_order) VALUES ($1, $2, $3, $4, $5)`,
          [data.title, data.description, data.icon, data.is_active, data.sort_order]
        );
      }
    }

    if (planList) {
      await query("DELETE FROM pricing_plans", []);
      for (const plan of planList) {
        const { id, ...data } = plan;
        await query(
          `INSERT INTO pricing_plans (package_name, price, duration_days, features, is_active, sort_order) VALUES ($1, $2, $3, $4::jsonb, $5, $6)`,
          [data.package_name, data.price, data.duration_days, JSON.stringify(data.features), data.is_active, data.sort_order]
        );
      }
    }

    if (settings) {
      const existing = await query("SELECT id FROM landing_page_settings LIMIT 1");
      if (existing.rows.length > 0) {
        const sets: string[] = [];
        const vals: any[] = [];
        let idx = 1;
        for (const key of SETTINGS_COLS) {
          if (key === "faq") {
            if (settings.faq !== undefined) {
              sets.push(`faq = $${idx++}::jsonb`);
              vals.push(JSON.stringify(settings.faq));
            }
          } else if ((settings as any)[key] !== undefined) {
            sets.push(`${key} = $${idx++}`);
            vals.push((settings as any)[key]);
          }
        }
        if (sets.length > 0) {
          sets.push(`updated_at = NOW()`);
          vals.push(existing.rows[0].id);
          await query(
            `UPDATE landing_page_settings SET ${sets.join(", ")} WHERE id = $${idx}`,
            vals
          );
        }
      } else {
        await query(
          `INSERT INTO landing_page_settings (${SETTINGS_COLS.join(", ")}) VALUES (${SETTINGS_COLS.map((_, i) => `$${i + 1}`).join(", ")})`,
          SETTINGS_COLS.map((col) => {
            if (col === "faq") return settings.faq ? JSON.stringify(settings.faq) : null;
            return (settings as any)[col] ?? null;
          })
        );
      }
    }

    return NextResponse.json({ success: true, message: "Landing page updated successfully" });
  } catch (error: any) {
    console.error("PATCH /api/landing-page error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}
