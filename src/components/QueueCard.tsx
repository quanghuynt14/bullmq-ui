import { Link } from '@tanstack/react-router'
import type { QueueStats } from '../server/queues.functions'

interface QueueCardProps {
  queue: QueueStats
}

export default function QueueCard({ queue }: QueueCardProps) {
  const { counts } = queue
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0)
  const hasIssues = counts.failed > 0 || counts.wait > 100

  return (
    <Link
      to="/queues/$queueName"
      params={{ queueName: queue.name }}
      className="block"
    >
      <div
        className={`border-l-2 ${
          queue.isPaused
            ? 'border-l-gray-500'
            : hasIssues
              ? 'border-l-amber-500'
              : 'border-l-emerald-500'
        } border border-border/50 bg-background hover:bg-muted/20 p-3 transition-colors`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-mono font-bold text-foreground uppercase tracking-wide">
            {queue.name}
          </span>
          {queue.isPaused && (
            <span className="text-[10px] font-mono bg-gray-500/20 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 border border-gray-500/30 uppercase">
              PAUSED
            </span>
          )}
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-5 gap-2">
          <MetricCell label="WAIT" value={counts.wait} alert={counts.wait > 100} />
          <MetricCell label="ACT" value={counts.active} />
          <MetricCell label="COMP" value={counts.completed} />
          <MetricCell label="FAIL" value={counts.failed} alert={counts.failed > 0} />
          <MetricCell label="TOT" value={total} />
        </div>
      </div>
    </Link>
  )
}

function MetricCell({
  label,
  value,
  alert,
}: {
  label: string
  value: number
  alert?: boolean
}) {
  return (
    <div className="text-center">
      <div
        className={`text-sm font-mono font-bold tabular-nums ${
          alert ? 'text-red-500' : 'text-foreground'
        }`}
      >
        {value > 999 ? `${(value / 1000).toFixed(1)}k` : value}
      </div>
      <div className="text-[8px] text-muted-foreground font-mono uppercase tracking-wider">
        {label}
      </div>
    </div>
  )
}
