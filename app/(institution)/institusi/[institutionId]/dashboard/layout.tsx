import { requireSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { query } from "@/lib/db";
import InstitutionShell from "@/app/components/institution/InstitutionShell";
import { ToastProvider } from "@/app/components/ui/toast";
import FeatureAccessGate from "@/components/guard/FeatureAccessGate";

interface Props {
  children: React.ReactNode;
  params: Promise<{ institutionId: string }>;
}

async function getInstitutionInfo(institutionId: number) {
  try {
    const result = await query(
      `SELECT id, name, npsn, jenjang, naungan, subscription_tier, academic_year_active, status
       FROM institutions WHERE id = $1`,
      [institutionId]
    );
    if (result.rows.length === 0) return null;
    return result.rows[0];
  } catch {
    return null;
  }
}

async function getUserRoles(
  appUserId: string,
  institutionId: number
): Promise<string[]> {
  try {
    const result = await query(
      `SELECT imr.value
       FROM public.institution_members im
       JOIN public.institution_members_role imr ON imr.parent_id = im.id
       WHERE im.app_user_id = $1 AND im.institution_id = $2 AND im.status = 'active'`,
      [appUserId, institutionId]
    );
    return result.rows.map((r: { value: string }) => r.value);
  } catch {
    return [];
  }
}

// Page-level RBAC: which roles can access which pages
const PAGE_ROLE_MAP: Record<string, string[]> = {
  "command-center": ["kepala_sekolah", "wakasek"],
  "ringkasan":      ["kepala_sekolah", "wakasek"],
  "surat":          ["kepala_sekolah", "wakasek"],
  "alerts":         ["kepala_sekolah", "wakasek"],
  "queue":          ["kepala_sekolah", "wakasek"],
  "kanban":         ["kepala_sekolah", "wakasek"],
  "pkg":            ["kepala_sekolah", "wakasek"],
  "akreditasi":     ["kepala_sekolah", "wakasek"],
  "review-proses":  ["kepala_sekolah", "wakasek"],
  "wakasek":       ["kepala_sekolah", "wakasek"],
  "bendahara":      ["kepala_sekolah", "bendahara"],
  "operator":       ["kepala_sekolah", "operator", "admin_sekolah"],
  "aktivitas":     ["kepala_sekolah", "wakasek", "operator", "admin_sekolah", "bendahara"],
  "tpg":            ["kepala_sekolah", "wakasek", "operator", "admin_sekolah"],
  "laporan-mengajar": ["kepala_sekolah", "wakasek", "operator", "admin_sekolah", "guru"],
  "approval":       ["kepala_sekolah", "wakasek", "operator", "admin_sekolah"],
  "langganan":      ["kepala_sekolah", "operator", "admin_sekolah", "bendahara"],
  "pengaturan":     ["kepala_sekolah", "operator", "admin_sekolah"],
  "guru":           ["kepala_sekolah", "wakasek", "operator", "admin_sekolah", "bendahara", "guru"],
};

export default async function InstitutionDashboardLayout({
  children,
  params,
}: Props) {
  const { institutionId } = await params;
  const instId = parseInt(institutionId, 10);
  if (isNaN(instId)) redirect("/dashboard");

  let session;
  try {
    session = await requireSession();
  } catch {
    redirect("/login");
  }

  const inst = await getInstitutionInfo(instId);
  if (!inst) redirect("/dashboard");

  if (inst.status !== "active") {
    redirect(`/institusi/${instId}/langganan-tidak-aktif`);
  }

  const roles = await getUserRoles(session.id, instId);
  const allowed = roles.some(
    (r) =>
      r === "kepala_sekolah" ||
      r === "operator" ||
      r === "wakasek" ||
      r === "bendahara" ||
      r === "admin_sekolah" ||
      r === "guru"
  );
  if (!allowed) redirect("/dashboard");

  // Page-level RBAC: check specific page access
  const headersList = await headers();
  const pathname = headersList.get("x-invoke-path") || headersList.get("referer") || "";
  const match = pathname.match(/\/institusi\/\d+\/dashboard(?:\/([^/]+))?/);
  const page = match?.[1] || ""; // "" means /institusi/[id]/dashboard (overview — all allowed)

  if (page && page in PAGE_ROLE_MAP) {
    const allowedRoles = PAGE_ROLE_MAP[page];
    const hasAccess = roles.some((r) => allowedRoles.includes(r));
    if (!hasAccess) {
      redirect(`/institusi/${instId}/dashboard`);
    }
  }

  return (
    <ToastProvider>
      <InstitutionShell
        institutionId={instId}
        institutionName={inst.name}
        userRoles={roles}
      >
        <FeatureAccessGate>{children}</FeatureAccessGate>
      </InstitutionShell>
    </ToastProvider>
  );
}
