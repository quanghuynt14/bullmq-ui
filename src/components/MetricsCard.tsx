import { ArrowDown, ArrowUp } from 'lucide-react'

interface MetricsCardProps {
  label: string
  value: number | string
  trend?: {
    value: number
    isPositive: boolean
  }
  subtitle?: string
  alert?: boolean
}

export function MetricsCard({
  label,
  value,
  trend,
  subtitle,
  alert,
}: MetricsCardProps) {
  return (
    <div className="border border-border/50 bg-muted/20 px-3 py-2">
      <div className="flex items-baseline gap-1.5">
        <span
          className={`text-lg font-mono font-bold tabular-nums ${
            alert ? 'text-red-500' : 'text-foreground'
          }`}
        >
          {value}
        </span>
        {trend && (
          trend.isPositive ? (
            <ArrowUp className="w-3 h-3 text-emerald-500" />
          ) : (
            <ArrowDown className="w-3 h-3 text-red-500" />
          )
        )}
      </div>
      {subtitle && (
        <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
          {subtitle}
        </div>
      )}
      <div className="text-[9px] text-muted-foreground font-mono uppercase tracking-wider mt-0.5">
        {label}
      </div>
      {trend && (
        <div className="text-[9px] font-mono text-muted-foreground mt-1">
          {trend.isPositive ? '+' : ''}{trend.value}%
        </div>
      )}
    </div>
  )
}
