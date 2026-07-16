import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import { uploadToR2 } from "@/lib/r2";

// GET - Fetch face enrollment status
export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("gurupro_session")?.value;

    if (!sessionCookie) {
      return NextResponse.json({ error: "Sesi tidak aktif. Silakan login kembali." }, { status: 401 });
    }

    const session = JSON.parse(sessionCookie);
    const userId = session.id;

    const result = await query(
      "SELECT is_enrolled, enrolled_at, pdp_consent_given, pdp_consent_date, face_descriptor FROM user_face_enrollment WHERE user_id = $1",
      [userId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({
        isEnrolled: false,
        enrolledAt: null,
        pdpConsentGiven: false,
        hasDescriptor: false,
      });
    }

    const enrollment = result.rows[0];
    return NextResponse.json({
      isEnrolled: enrollment.is_enrolled,
      enrolledAt: enrollment.enrolled_at,
      pdpConsentGiven: enrollment.pdp_consent_given,
      pdpConsentDate: enrollment.pdp_consent_date,
      hasDescriptor: !!enrollment.face_descriptor,
    });
  } catch (error: any) {
    console.error("Face enrollment GET error:", error);
    return NextResponse.json({ error: error.message || "Gagal mengambil data enrollment wajah." }, { status: 500 });
  }
}

// POST - Save face enrollment
export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("gurupro_session")?.value;

    if (!sessionCookie) {
      return NextResponse.json({ error: "Sesi tidak aktif. Silakan login kembali." }, { status: 401 });
    }

    const session = JSON.parse(sessionCookie);
    const userId = session.id;

    const body = await req.json();
    const { faceImages, faceDescriptors, pdpConsent } = body;

    if (!faceImages || !Array.isArray(faceImages) || faceImages.length !== 5) {
      return NextResponse.json({ error: "Harus ada tepat 5 gambar wajah." }, { status: 400 });
    }

    if (!pdpConsent) {
      return NextResponse.json({ error: "Persetujuan PDP harus diberikan." }, { status: 400 });
    }

    // Upload each face image to R2 storage
    const uploadedUrls: string[] = [];
    for (let i = 0; i < faceImages.length; i++) {
      const imageData = faceImages[i];
      if (!imageData || typeof imageData !== "string" || !imageData.startsWith("data:image")) {
        return NextResponse.json({ error: `Gambar wajah ke-${i + 1} tidak valid.` }, { status: 400 });
      }

      try {
        // Convert base64 to buffer
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");

        const fileName = `face-enrollment/${userId}/face_${i + 1}_${Date.now()}.jpg`;
        const url = await uploadToR2(buffer, fileName, "image/jpeg");

        if (!url) {
          throw new Error("Failed to upload image");
        }
        uploadedUrls.push(url);
      } catch (err) {
        console.error(`Failed to upload face image ${i + 1}:`, err);
        return NextResponse.json({ error: `Gagal mengunggah gambar wajah ke-${i + 1}.` }, { status: 500 });
      }
    }

    // Calculate average face descriptor from all captures
    let averageDescriptor: number[] | null = null;
    if (faceDescriptors && Array.isArray(faceDescriptors)) {
      const validDescriptors = faceDescriptors.filter(
        (d: string | null) => d && typeof d === "string"
      );

      if (validDescriptors.length > 0) {
        // Parse and average all descriptors
        const parsedDescriptors = validDescriptors.map((d: string) => {
          try {
            return JSON.parse(d);
          } catch {
            return null;
          }
        }).filter(Boolean);

        if (parsedDescriptors.length > 0) {
          const descriptorLength = parsedDescriptors[0].length;
          averageDescriptor = [];

          for (let i = 0; i < descriptorLength; i++) {
            let sum = 0;
            let count = 0;
            for (const desc of parsedDescriptors) {
              if (desc[i] !== undefined) {
                sum += desc[i];
                count++;
              }
            }
            averageDescriptor.push(count > 0 ? sum / count : 0);
          }
        }
      }
    }

    // Check if enrollment exists
    const existing = await query(
      "SELECT id FROM user_face_enrollment WHERE user_id = $1",
      [userId]
    );

    const faceDescriptorJson = averageDescriptor ? JSON.stringify(averageDescriptor) : null;

    if (existing.rows.length > 0) {
      // Update existing enrollment
      await query(
        `UPDATE user_face_enrollment SET
          face_image_1 = $2,
          face_image_2 = $3,
          face_image_3 = $4,
          face_image_4 = $5,
          face_image_5 = $6,
          face_descriptor = $7,
          is_enrolled = true,
          enrolled_at = CURRENT_TIMESTAMP,
          pdp_consent_given = true,
          pdp_consent_version = $8,
          pdp_consent_date = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1`,
        [
          userId,
          uploadedUrls[0],
          uploadedUrls[1],
          uploadedUrls[2],
          uploadedUrls[3],
          uploadedUrls[4],
          faceDescriptorJson,
          "v1.0",
        ]
      );
    } else {
      // Insert new enrollment
      await query(
        `INSERT INTO user_face_enrollment (
          user_id,
          face_image_1,
          face_image_2,
          face_image_3,
          face_image_4,
          face_image_5,
          face_descriptor,
          is_enrolled,
          enrolled_at,
          pdp_consent_given,
          pdp_consent_version,
          pdp_consent_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, CURRENT_TIMESTAMP, true, $8, CURRENT_TIMESTAMP)`,
        [
          userId,
          uploadedUrls[0],
          uploadedUrls[1],
          uploadedUrls[2],
          uploadedUrls[3],
          uploadedUrls[4],
          faceDescriptorJson,
          "v1.0",
        ]
      );
    }

    return NextResponse.json({
      message: "Data wajah berhasil disimpan!",
      isEnrolled: true,
      enrolledAt: new Date().toISOString(),
      hasDescriptor: !!averageDescriptor,
    });
  } catch (error: any) {
    console.error("Face enrollment POST error:", error);
    return NextResponse.json({ error: error.message || "Gagal menyimpan data wajah." }, { status: 500 });
  }
}

// DELETE - Remove face enrollment
export async function DELETE() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("gurupro_session")?.value;

    if (!sessionCookie) {
      return NextResponse.json({ error: "Sesi tidak aktif. Silakan login kembali." }, { status: 401 });
    }

    const session = JSON.parse(sessionCookie);
    const userId = session.id;

    await query("DELETE FROM user_face_enrollment WHERE user_id = $1", [userId]);

    return NextResponse.json({
      message: "Data wajah berhasil dihapus.",
      isEnrolled: false,
    });
  } catch (error: any) {
    console.error("Face enrollment DELETE error:", error);
    return NextResponse.json({ error: error.message || "Gagal menghapus data wajah." }, { status: 500 });
  }
}
