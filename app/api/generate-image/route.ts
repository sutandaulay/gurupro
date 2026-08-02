import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserPoinAccess, consumeUserPoin, logFailedPoinUsage } from "@/src/services/poin-service";
import { calculatePoinFromTokens } from "@/src/lib/ai-usage";

export async function POST(req: Request) {
  try {
    // Auth: hanya user login
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("gurupro_session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Sesi tidak aktif. Silakan login terlebih dahulu." }, { status: 401 });
    }
    let userId: string | null = null;
    try {
      const sessionData = JSON.parse(sessionCookie);
      userId = sessionData?.id || null;
    } catch {
      return NextResponse.json({ error: "Sesi tidak valid." }, { status: 401 });
    }
    if (!userId) {
      return NextResponse.json({ error: "Sesi tidak valid." }, { status: 401 });
    }

    // Poin check (non-admin)
    const userDb = await (await import("@/lib/db")).query(
      "SELECT role FROM users WHERE id = $1",
      [userId]
    );
    const role = userDb?.rows?.[0]?.role;
    if (role !== "admin") {
      const poinAccess = await getUserPoinAccess(userId);
      if (!poinAccess.access.allowed) {
        return NextResponse.json({
          error: poinAccess.access.reason === "subscription_expired"
            ? "Masa aktif langganan akun Anda telah habis! Silakan lakukan perpanjangan langganan terlebih dahulu."
            : "Poin GuruPRO Anda telah habis! Silakan lakukan isi ulang atau upgrade langganan di Landing Page.",
          reason: poinAccess.access.reason,
          remainingPoin: 0,
        }, { status: 403 });
      }
    }

    const { description } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY tidak dikonfigurasi di environment (.env.local)" }, { status: 500 });
    }

    if (!description || description.trim() === "") {
      return NextResponse.json({ error: "Deskripsi gambar kosong" }, { status: 400 });
    }

    const buildImageGenerationPrompt = (desc: string) => {
      return `A clean educational illustration for a school textbook about: ${desc}. Style: flat vector design, vibrant friendly colors, white background, high detail. Important: purely visual illustration without any written text, labels, or annotations in the image.`;
    };

    const buildSimpleImageGenerationPrompt = (desc: string) => {
      return `Simple educational illustration: ${desc}. Flat design, colorful, white background, no text.`;
    };

    const enhancedPrompt = buildImageGenerationPrompt(description);

    // Call Imagen API
    const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`;

    const payload = {
      instances: [{ prompt: enhancedPrompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio: '1:1',
        safetyFilterLevel: 'BLOCK_MEDIUM_AND_ABOVE'
      }
    };

    console.log('[Imagen REST API] Calling Imagen 4.0 on server-side with prompt length:', enhancedPrompt.length);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();
    let data;

    if (!response.ok || !responseText || responseText.trim() === '') {
      console.log('[Imagen REST API] Error or empty response, retrying with simplified prompt...');
      const simplePrompt = buildSimpleImageGenerationPrompt(description);
      const retryPayload = {
        instances: [{ prompt: simplePrompt }],
        parameters: { sampleCount: 1, aspectRatio: '1:1' }
      };

      const retryResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(retryPayload)
      });

      const retryText = await retryResponse.text();
      if (!retryResponse.ok || !retryText || retryText.trim() === '') {
        throw new Error(`Google Imagen API returned status ${retryResponse.status}: ${retryText || 'Empty Response'}`);
      }
      data = JSON.parse(retryText);
    } else {
      data = JSON.parse(responseText);
    }

    let base64Image = null;
    if (data.predictions && data.predictions[0] && data.predictions[0].bytesBase64Encoded) {
      base64Image = `data:image/png;base64,${data.predictions[0].bytesBase64Encoded}`;
    }

    if (!base64Image) {
      throw new Error("No image bytes returned by Google Generative AI Imagen model.");
    }

    // Deduct Poin based on actual usage (non-admin)
    if (role !== "admin") {
      try {
        // Imagen API estimates roughly 1000 tokens per image (input+output)
        const poinCalc = calculatePoinFromTokens(300, 700, 0);

        await consumeUserPoin(userId as string, poinCalc.rawTokens, "generate-image", {
          model: "imagen-4.0-generate-001",
          provider: "gemini",
        });

        console.log(`[Generate Image] Poin deducted: ${poinCalc.poinNeeded} (${poinCalc.rawTokens} raw tokens)`);
      } catch (poinError) {
        console.error("[Generate Image] Poin deduction failed:", poinError);
      }
    }

    return NextResponse.json({ image: base64Image });
  } catch (error: any) {
    console.error("Imagen server API error:", error);
    let errMsg = error.message || "Gagal membuat gambar";
    if (
      errMsg.includes("paid plans") || 
      errMsg.includes("upgrade your account") || 
      errMsg.includes("billing") ||
      errMsg.includes("INVALID_ARGUMENT")
    ) {
      errMsg = "Fungsi pembuatan gambar ilustrasi (Google Imagen) memerlukan API Key dengan metode pembayaran aktif (Pay-as-you-go billing) di Google AI Studio. Akun retail/langganan Google AI Plus (Gemini Advanced) Anda berbeda dengan penggunaan API Key untuk pengembang. Silakan buka https://aistudio.google.com/ untuk mengaktifkan tagihan (Billing) pada proyek API Anda.";
    }
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
