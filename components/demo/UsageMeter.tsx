'use client';

import { cn } from '@/lib/utils';

interface UsageMeterProps {
  label: string;
  used: number;
  limit: number;
  unit?: string;
  className?: string;
  showPercentage?: boolean;
  isPriceFormat?: boolean; // New prop to format as price
}

export function UsageMeter({
  label,
  used,
  limit,
  unit = '',
  className,
  showPercentage = true,
  isPriceFormat = false,
}: UsageMeterProps) {
  const percentage = Math.min(100, (used / limit) * 100);
  const remaining = Math.max(0, limit - used);

  // Determine color based on usage level
  const getColorClass = () => {
    if (percentage >= 100) return 'bg-destructive';
    if (percentage >= 90) return 'bg-destructive/80';
    if (percentage >= 75) return 'bg-amber-500';
    return 'bg-primary';
  };

  const getTextColorClass = () => {
    if (percentage >= 100) return 'text-destructive';
    if (percentage >= 90) return 'text-destructive/80';
    if (percentage >= 75) return 'text-amber-600 dark:text-amber-400';
    return 'text-muted-foreground';
  };

  const formatNumber = (num: number) => {
    if (isPriceFormat) {
      return `$${num.toFixed(2)}`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}k`;
    }
    return num.toLocaleString();
  };

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-foreground">{label}</span>
        <span className={cn('font-mono', getTextColorClass())}>
          {formatNumber(used)}/{formatNumber(limit)}{!isPriceFormat && unit && ` ${unit}`}
          {showPercentage && (
            <span className="ml-1">({percentage.toFixed(0)}%)</span>
          )}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full transition-all duration-300', getColorClass())}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {percentage >= 75 && (
        <p className={cn('text-xs', getTextColorClass())}>
          {percentage >= 100
            ? 'Limit reached'
            : `${formatNumber(remaining)}${!isPriceFormat && unit ? ` ${unit}` : ''} remaining`}
        </p>
      )}
    </div>
  );
}

interface UsageStatsCardProps {
  className?: string;
}

export function UsageStatsCard({ className }: UsageStatsCardProps) {
  // This would typically fetch from the usage storage
  // For now, using placeholder values that would be replaced with real data
  return (
    <div
      className={cn(
        'space-y-4 rounded-xl border border-border bg-card p-4',
        className
      )}
    >
      <h3 className="text-sm font-medium text-foreground">Usage This Session</h3>
      <div className="space-y-3">
        <UsageMeter
          label="Session Cost"
          used={0}
          limit={5}
          isPriceFormat={true}
        />
        <UsageMeter
          label="Documents"
          used={0}
          limit={20}
          unit="docs"
        />
      </div>
    </div>
  );
}
