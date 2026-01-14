'use client';

import { Warning, Sparkle, ArrowRight } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { UPGRADE_MESSAGES } from '@/lib/demo-limits/config';

type LimitType = 'priceLimit' | 'documentLimit' | 'fileTooLarge' | 'featureDisabled';

interface LimitWarningProps {
  type: LimitType | null;
  className?: string;
  onUpgrade?: () => void;
  customMessage?: string;
}

export function LimitWarning({
  type,
  className,
  onUpgrade,
  customMessage,
}: LimitWarningProps) {
  if (!type) return null;
  const message = UPGRADE_MESSAGES[type];

  return (
    <div
      className={cn(
        'rounded-xl border border-destructive/30 bg-destructive/5 p-4',
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
          <Warning weight="fill" className="size-5 text-destructive" />
        </div>
        <div className="flex-1 space-y-2">
          <h4 className="font-medium text-foreground">{message.title}</h4>
          <p className="text-sm text-muted-foreground">
            {customMessage || message.description}
          </p>
          <Button
            variant="default"
            size="sm"
            onClick={onUpgrade}
            className="mt-2"
          >
            <Sparkle weight="duotone" data-icon="inline-start" />
            {message.cta}
            <ArrowRight data-icon="inline-end" />
          </Button>
        </div>
      </div>
    </div>
  );
}

interface LimitApproachingWarningProps {
  type: 'tokens' | 'ocr';
  percentUsed: number;
  className?: string;
}

export function LimitApproachingWarning({
  type,
  percentUsed,
  className,
}: LimitApproachingWarningProps) {
  if (percentUsed < 75) return null;

  const isExceeded = percentUsed >= 100;
  const isCritical = percentUsed >= 90;

  const typeLabels = {
    tokens: 'Token',
    ocr: 'OCR',
  };

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
        isExceeded
          ? 'bg-destructive/10 text-destructive'
          : isCritical
          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
          : 'bg-amber-500/5 text-amber-600 dark:text-amber-400',
        className
      )}
    >
      <Warning weight={isExceeded ? 'fill' : 'bold'} className="size-4" />
      <span>
        {isExceeded
          ? `${typeLabels[type]} limit reached. Upgrade to continue.`
          : isCritical
          ? `${typeLabels[type]} limit at ${percentUsed.toFixed(0)}%. Running low!`
          : `${typeLabels[type]} usage at ${percentUsed.toFixed(0)}%.`}
      </span>
    </div>
  );
}
