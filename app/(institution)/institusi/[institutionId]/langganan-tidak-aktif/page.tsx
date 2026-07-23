import { query } from "@/lib/db";

async function getInstitutionInfo(institutionId: number) {
  try {
    const result = await query(
      `SELECT id, name, subscription_tier, status
       FROM institutions WHERE id = $1`,
      [institutionId]
    );
    if (result.rows.length === 0) return null;
    return result.rows[0];
  } catch {
    return null;
  }
}

export default async function SubscriptionInactivePage({
  params,
}: {
  params: Promise<{ institutionId: string }>;
}) {
  const { institutionId } = await params;
  const instId = parseInt(institutionId, 10);

  const institution = await getInstitutionInfo(instId);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
        <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="text-amber-600"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <line x1="2" y1="10" x2="22" y2="10" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">
          Langganan Tidak Aktif
        </h1>
        <p className="text-sm text-gray-600 mb-6">
          Institusi <strong>{institution?.name || "ini"}</strong> saat ini tidak
          memiliki langganan aktif. Silakan hubungi administrator untuk
          melakukan perpanjangan.
        </p>
        <a
          href="/dashboard"
          className="inline-block bg-violet-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-violet-700 transition-colors"
        >
          Kembali ke Dashboard
        </a>
      </div>
    </div>
  );
}
