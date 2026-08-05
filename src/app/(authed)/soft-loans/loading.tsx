import { SkeletonCard, SkeletonTable } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-32 bg-muted rounded animate-pulse" />
        <div className="h-4 w-40 bg-muted rounded animate-pulse" />
      </div>
      <SkeletonCard rows={2} />
      <SkeletonTable rows={5} columns={5} />
    </div>
  );
}
