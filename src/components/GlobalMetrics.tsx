import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { TIME_RANGES, getGlobalMetrics } from '../server/queues.functions'

import type { TimeRangeKey } from '../server/queues.functions'

export function GlobalMetrics() {
  const [timeRange, setTimeRange] = useState<TimeRangeKey>('1h')

  const { data: metrics } = useQuery({
    queryKey: ['global-metrics', timeRange],
    queryFn: () => getGlobalMetrics({ data: { timeRange } }),
    refetchInterval: 1000,
    staleTime: 0,
  })

  if (!metrics) {
    return (
      <div className="grid grid-cols-6 gap-3 mb-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="border border-border/50 bg-muted/10 p-3">
            <div className="h-4 bg-muted/50 w-12 mb-1" />
            <div className="h-3 bg-muted/40 w-20" />
          </div>
        ))}
      </div>
    )
  }

  const stats = [
    { label: 'QUEUES', value: metrics.queueCount },
    { label: 'WAITING', value: metrics.jobCounts.wait, alert: metrics.jobCounts.wait > 100 },
    { label: 'ACTIVE', value: metrics.jobCounts.active },
    { label: 'COMPLETED', value: metrics.jobCounts.completed },
    { label: 'FAILED', value: metrics.jobCounts.failed, alert: metrics.jobCounts.failed > 10 },
    { 
      label: 'THROUGHPUT', 
      value: `${Math.round(metrics.throughput.completed)}/m`,
      subtitle: `${(metrics.throughput.completed / 60).toFixed(2)}/s`
    },
  ]

  return (
    <div className="mb-6">
      <div className="grid grid-cols-6 gap-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="border border-border/50 bg-muted/20 px-3 py-2"
          >
            <div className="flex items-baseline gap-1.5">
              <span
                className={`text-lg font-mono font-bold tabular-nums ${
                  stat.alert ? 'text-red-500' : 'text-foreground'
                }`}
              >
                {stat.value}
              </span>
            </div>
            {stat.subtitle && (
              <div className="text-[10px] text-muted-foreground font-mono">
                {stat.subtitle}
              </div>
            )}
            <div className="text-[9px] text-muted-foreground font-mono uppercase tracking-wider mt-0.5">
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
