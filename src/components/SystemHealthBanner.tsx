import { useQuery } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { getSystemHealth } from '../server/health.functions'
import type { HealthStatus } from '../server/health-monitor.functions'

export function SystemHealthBanner() {
  const { data: health } = useQuery({
    queryKey: ['system-health'],
    queryFn: () => getSystemHealth(),
    refetchInterval: 1000, // 1s refresh - real-time matters
    staleTime: 0,
  })

  if (!health) {
    return (
      <div className="border border-border/50 mb-6 bg-background">
        <div className="px-6 py-4">
          <div className="h-4 bg-muted/50 w-32 mb-2" />
          <div className="h-3 bg-muted/30 w-48" />
        </div>
      </div>
    )
  }

  const config = getStatusConfig(health.status)

  return (
    <div className={`border-l-2 ${config.borderColor} bg-background mb-6`}>
      <div className="px-6 py-4">
        {/* Dense header - pure data */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className={`text-base font-mono uppercase tracking-wide ${config.textColor}`}>
                {config.status}
              </div>
              <div className="text-xs text-muted-foreground font-mono">
                {new Date().toLocaleTimeString('en-US', { hour12: false })}
              </div>
            </div>
          </div>

          {/* Status distribution - critical operational data */}
          <div className="flex items-center gap-4 font-mono text-xs">
            <StatusMetric
              value={health.metrics.healthyQueues}
              label="OK"
              color="text-emerald-500"
            />
            <StatusMetric
              value={health.metrics.warningQueues}
              label="WARN"
              color="text-amber-500"
            />
            <StatusMetric
              value={health.metrics.criticalQueues}
              label="CRIT"
              color="text-red-500"
            />
          </div>
        </div>

        {/* Critical alerts only - no noise */}
        {(health.metrics.criticalQueues > 0 || health.predictions.length > 0) && (
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border/50">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
            <div className="flex items-center gap-6 text-xs font-mono">
              {health.predictions.length > 0 && (
                <div className="text-muted-foreground">
                  <span className="text-amber-500 font-bold">{health.predictions.length}</span> PREDICTIONS
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Compact status metric
function StatusMetric({
  value,
  label,
  color,
}: {
  value: number
  label: string
  color: string
}) {
  if (value === 0) return null
  return (
    <div className="flex items-baseline gap-1.5">
      <span className={`text-xl font-mono font-bold tabular-nums ${color}`}>
        {value}
      </span>
      <span className="text-[10px] text-muted-foreground uppercase">{label}</span>
    </div>
  )
}

function getStatusConfig(status: HealthStatus) {
  switch (status) {
    case 'healthy':
      return {
        status: 'OPERATIONAL',
        borderColor: 'border-emerald-500',
        textColor: 'text-emerald-500',
      }
    case 'warning':
      return {
        status: 'DEGRADED',
        borderColor: 'border-amber-500',
        textColor: 'text-amber-500',
      }
    case 'critical':
      return {
        status: 'CRITICAL',
        borderColor: 'border-red-500',
        textColor: 'text-red-500',
      }
  }
}
