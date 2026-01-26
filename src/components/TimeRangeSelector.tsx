import { useState } from 'react'

type TimeRange = '1m' | '1h' | '24h' | '7d'

const TIME_RANGES: Record<TimeRange, { label: string; minutes: number }> = {
  '1m': { label: '1M', minutes: 1 },
  '1h': { label: '1H', minutes: 60 },
  '24h': { label: '24H', minutes: 1440 },
  '7d': { label: '7D', minutes: 10080 },
}

export function TimeRangeSelector({
  onChange,
  defaultRange = '1h',
}: {
  onChange: (minutes: number) => void
  defaultRange?: TimeRange
}) {
  const [selected, setSelected] = useState<TimeRange>(defaultRange)

  const handleChange = (range: TimeRange) => {
    setSelected(range)
    onChange(TIME_RANGES[range].minutes)
  }

  return (
    <div className="flex gap-1">
      {Object.entries(TIME_RANGES).map(([key, { label }]) => (
        <button
          key={key}
          onClick={() => handleChange(key as TimeRange)}
          className={`border border-border/50 px-2 py-1 text-[10px] font-mono uppercase ${
            selected === key
              ? 'bg-foreground text-background'
              : 'bg-background hover:bg-muted/20'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
