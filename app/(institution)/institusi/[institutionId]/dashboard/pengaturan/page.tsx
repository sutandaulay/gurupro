export default async function SettingsPage({
  params,
}: {
  params: Promise<{ institutionId: string }>;
}) {
  const { institutionId } = await params;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Pengaturan Institusi
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Kelola profil, branding, dan pengaturan lainnya.
        </p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <p className="text-gray-500">Fitur Pengaturan akan segera hadir.</p>
      </div>
    </div>
  );
}
