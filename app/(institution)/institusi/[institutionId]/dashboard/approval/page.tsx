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

export default async function ApprovalPage({
  params,
}: {
  params: Promise<{ institutionId: string }>;
}) {
  const { institutionId } = await params;
  const instId = parseInt(institutionId, 10);
  const session = await requireSession();
  const roles = await getRoles(session.id, instId);

  if (!roles.includes("kepala_sekolah")) {
    redirect(`/institusi/${instId}/dashboard`);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Approval / Persetujuan
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Item yang butuh persetujuan Kepala Sekolah.
        </p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <p className="text-gray-500">Fitur Approval akan segera hadir.</p>
      </div>
    </div>
  );
}
