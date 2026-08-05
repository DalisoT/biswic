import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Reusable skeleton primitives for loading states.
 * Use while data is loading (in loading.tsx, suspense fallbacks, etc.)
 */

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-muted', className)}
      aria-hidden="true"
      {...props}
    />
  );
}

function SkeletonText({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <Skeleton className={cn('h-4 w-full', className)} {...props} />;
}

function SkeletonHeading({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <Skeleton className={cn('h-7 w-2/3', className)} {...props} />;
}

function SkeletonButton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <Skeleton className={cn('h-10 w-32', className)} {...props} />;
}

function SkeletonBadge({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <Skeleton className={cn('h-5 w-16 rounded-full', className)} {...props} />;
}

function SkeletonAvatar({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <Skeleton className={cn('h-10 w-10 rounded-full', className)} {...props} />;
}

interface SkeletonCardProps {
  className?: string;
  rows?: number;
  withHeader?: boolean;
}

function SkeletonCard({ className, rows = 3, withHeader = true }: SkeletonCardProps) {
  return (
    <div className={cn('rounded-lg border bg-card p-6 shadow-sm space-y-4', className)}>
      {withHeader && (
        <div className="space-y-2">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      )}
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className={cn('h-4', i === rows - 1 ? 'w-3/4' : 'w-full')} />
        ))}
      </div>
    </div>
  );
}

interface SkeletonStatProps {
  className?: string;
}

function SkeletonStat({ className }: SkeletonStatProps) {
  return (
    <div className={cn('rounded-lg border bg-card p-6 shadow-sm space-y-2', className)}>
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="h-3 w-1/3" />
    </div>
  );
}

interface SkeletonTableProps {
  className?: string;
  rows?: number;
  columns?: number;
}

function SkeletonTable({ className, rows = 5, columns = 4 }: SkeletonTableProps) {
  return (
    <div className={cn('rounded-lg border bg-card overflow-hidden', className)}>
      <div className="bg-muted/30 border-b px-4 py-3 flex gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      <div className="divide-y">
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div key={rowIdx} className="px-4 py-3 flex gap-4">
            {Array.from({ length: columns }).map((_, colIdx) => (
              <Skeleton
                key={colIdx}
                className={cn(
                  'h-4 flex-1',
                  colIdx === columns - 1 ? 'w-1/2' : '',
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

interface SkeletonListProps {
  className?: string;
  items?: number;
}

function SkeletonListItem() {
  return (
    <div className="flex items-center gap-3 p-3 border-b last:border-0">
      <SkeletonAvatar className="h-10 w-10 shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <Skeleton className="h-3 w-12" />
    </div>
  );
}

function SkeletonList({ className, items = 5 }: SkeletonListProps) {
  return (
    <div className={cn('rounded-lg border bg-card divide-y', className)}>
      {Array.from({ length: items }).map((_, i) => (
        <SkeletonListItem key={i} />
      ))}
    </div>
  );
}

interface PageSkeletonProps {
  className?: string;
  showTitle?: boolean;
}

function PageSkeleton({ className, showTitle = true }: PageSkeletonProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {showTitle && (
        <div className="space-y-2">
          <SkeletonHeading className="h-8 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SkeletonStat />
        <SkeletonStat />
        <SkeletonStat />
      </div>
      <SkeletonCard rows={4} />
      <SkeletonTable rows={6} />
    </div>
  );
}

export {
  Skeleton,
  SkeletonText,
  SkeletonHeading,
  SkeletonButton,
  SkeletonBadge,
  SkeletonAvatar,
  SkeletonCard,
  SkeletonStat,
  SkeletonTable,
  SkeletonList,
  SkeletonListItem,
  PageSkeleton,
};
