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

export default async function SubscriptionPage({
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

  const [instRes] = await Promise.all([
    query(
      `SELECT name, subscription_tier, status FROM institutions WHERE id = $1`,
      [instId]
    ),
  ]);

  const institution = instRes.rows[0];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Langganan & Billing
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Status paket dan riwayat pembayaran {institution?.name}.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Tier Sekarang</p>
          <p className="text-xl font-bold text-gray-900 mt-1 capitalize">
            {institution?.subscription_tier || "-"}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Status</p>
          <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium mt-2">
            {institution?.status || "-"}
          </span>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Institusi</p>
          <p className="text-base font-medium text-gray-900 mt-1 truncate">
            {institution?.name}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <p className="text-gray-500">Fitur upgrade / downgrade dan riwayat pembayaran akan segera hadir.</p>
      </div>
    </div>
  );
}
