export default function AdminLoading() {
  return (
    <div className="animate-pulse space-y-5" aria-label="Loading administrator data">
      <div className="h-9 w-56 bg-gold/20" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-28 bg-white" />
        ))}
      </div>
    </div>
  );
}
