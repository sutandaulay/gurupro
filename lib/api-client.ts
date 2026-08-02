const SCHOOL_ID_KEY = "gurupro_school_selected"

function getSchoolId(): string | null {
  if (typeof window === "undefined") return null
  try {
    return sessionStorage.getItem(SCHOOL_ID_KEY)
  } catch {
    return null
  }
}

function addSchoolId(url: string): string {
  const schoolId = getSchoolId()
  if (!schoolId) return url
  const separator = url.includes("?") ? "&" : "?"
  return `${url}${separator}school_id=${encodeURIComponent(schoolId)}`
}

export async function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  return fetch(addSchoolId(url), {
    ...options,
    credentials: 'include',
  })
}

export function apiUrl(url: string): string {
  return addSchoolId(url)
}
