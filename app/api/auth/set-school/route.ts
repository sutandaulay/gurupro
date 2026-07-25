import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getUserId, requireSchoolAccess } from "@/lib/school-access"

export async function POST(req: Request) {
  try {
    const { schoolId } = await req.json()
    if (!schoolId) {
      return NextResponse.json({ error: "schoolId wajib diisi" }, { status: 400 })
    }

    await requireSchoolAccess(schoolId)

    const cookieStore = await cookies()
    cookieStore.set("gurupro_school_selected", schoolId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Set school error:", error)
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status })
  }
}
