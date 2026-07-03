import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
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
