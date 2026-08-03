import React, { useMemo } from 'react';
import { Activity } from 'lucide-react';
import { clsx } from 'clsx';

interface TokenStatusBadgeProps {
  tokensUsed: number;
  tokenLimit: number;
}

export function TokenStatusBadge({ tokensUsed, tokenLimit }: TokenStatusBadgeProps) {
  const percentage = tokenLimit > 0 ? (tokensUsed / tokenLimit) * 100 : 0;

  const status = useMemo(() => {
    if (percentage >= 90) return 'critical';
    if (percentage >= 75) return 'warning';
    return 'healthy';
  }, [percentage]);

  const statusConfig = {
    healthy: {
      color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      icon: 'text-emerald-500',
      text: 'Consumo Óptimo'
    },
    warning: {
      color: 'bg-amber-100 text-amber-800 border-amber-200',
      icon: 'text-amber-500',
      text: 'Consumo Medio'
    },
    critical: {
      color: 'bg-rose-100 text-rose-800 border-rose-200',
      icon: 'text-rose-500',
      text: 'Consumo Alto'
    }
  };

  const config = statusConfig[status];

  return (
    <div className={clsx(
      "flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium transition-colors",
      config.color
    )}>
      <Activity className={clsx("w-4 h-4", config.icon)} />
      <span>{config.text}</span>
      <span className="opacity-75 text-xs ml-1">
        ({Math.round(percentage)}%)
      </span>
    </div>
  );
}
