import { Skeleton } from '@/components/ui/skeleton';

export default function NoteLoading() {
  return (
    <section className="mx-auto w-full max-w-155 px-6 py-8 sm:px-8 sm:py-10">
      <div className="mb-6 border-b border-neutral-900 pb-5">
        <Skeleton className="h-5 w-56 rounded-sm bg-neutral-900" />
        <Skeleton className="mt-3 h-3 w-40 rounded-sm bg-neutral-900" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-3 w-full rounded-sm bg-neutral-900" />
        <Skeleton className="h-3 w-11/12 rounded-sm bg-neutral-900" />
        <Skeleton className="h-3 w-10/12 rounded-sm bg-neutral-900" />
        <Skeleton className="h-24 w-full rounded-sm bg-neutral-900" />
      </div>
    </section>
  );
}
