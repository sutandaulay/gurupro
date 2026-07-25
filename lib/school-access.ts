import { query } from "@/lib/db"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function getUserId(): Promise<string> {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get("gurupro_session")?.value
  if (!sessionCookie) {
    throw new Error("Unauthorized")
  }
  const session = JSON.parse(sessionCookie)
  return session.id
}

export async function getUserIdSafe(): Promise<string | null> {
  try {
    return await getUserId()
  } catch {
    return null
  }
}

export async function requireSchoolAccess(schoolId: string): Promise<{ userId: string }> {
  const userId = await getUserId()
  const check = await query(
    `SELECT id FROM schools WHERE id = $1 AND user_id = $2`,
    [schoolId, userId]
  )
  if (check.rows.length === 0) {
    const assigned = await query(
      `SELECT id FROM user_school_assignments WHERE "userId" = $1 AND "schoolId" = $2 LIMIT 1`,
      [userId, schoolId]
    )
    if (assigned.rows.length === 0) {
      throw new Error("Forbidden")
    }
  }
  return { userId }
}

export function unauthorized() {
  return NextResponse.json({ error: "Sesi tidak aktif" }, { status: 401 })
}

export function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}
