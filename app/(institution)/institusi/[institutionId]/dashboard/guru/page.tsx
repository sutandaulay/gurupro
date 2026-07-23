import { query } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { redirect } from "next/navigation";

async function getRoles(appUserId: string, institutionId: number) {
  const result = await query(
    `SELECT imr.value
     FROM institution_members im
     JOIN institution_members_role imr ON imr.parent_id = im.id
     WHERE im.app_user_id = $1 AND im.institution_id = $2 AND im.status = 'active'`,
    [appUserId, institutionId]
  );
  return result.rows.map((r: any) => r.value);
}

export default async function GuruManagementPage({
  params,
}: {
  params: Promise<{ institutionId: string }>;
}) {
  const { institutionId } = await params;
  const instId = parseInt(institutionId, 10);
  const session = await requireSession();
  const roles = await getRoles(session.id, instId);

  if (!roles.includes("kepala_sekolah") && !roles.includes("operator")) {
    redirect("/dashboard");
  }

  redirect(`/dashboard/institution/${instId}/operator`);
}
