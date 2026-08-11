export function LoadingState({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center p-10 text-gray-500">
      <p>{label || 'Memuat data...'}</p>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="p-4 rounded border border-red-200 bg-red-50 text-red-700">
      {message}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="p-8 text-center text-gray-500 border rounded-lg bg-white">
      {message}
    </div>
  );
}
