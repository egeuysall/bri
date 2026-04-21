export default function UsernameLoading() {
  return (
    <div className="min-h-screen bg-bg">
      <div className="grid min-h-screen grid-cols-[13rem_1fr]">
        <aside className="border-r border-neutral-900 p-3">
          <div className="h-8 w-full rounded-sm border border-neutral-800" />
          <div className="mt-4 space-y-2">
            <div className="h-8 rounded-sm border border-neutral-900" />
            <div className="h-8 rounded-sm border border-neutral-900" />
            <div className="h-8 rounded-sm border border-neutral-900" />
          </div>
        </aside>
        <main className="p-6 md:p-8">
          <div className="space-y-3">
            <div className="h-4 w-24 rounded-sm border border-neutral-900" />
            <div className="h-16 rounded-sm border border-neutral-900" />
            <div className="h-16 rounded-sm border border-neutral-900" />
            <div className="h-16 rounded-sm border border-neutral-900" />
          </div>
        </main>
      </div>
    </div>
  );
}
