export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-pulse" aria-busy="true" aria-label="Đang tải">
      <div className="h-10 w-48 rounded-xl bg-white/5" />
      <div className="h-4 max-w-xl rounded-lg bg-white/5" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-40 rounded-2xl bg-white/5" />
        <div className="h-40 rounded-2xl bg-white/5" />
      </div>
      <div className="h-72 rounded-2xl bg-white/5" />
    </div>
  );
}
