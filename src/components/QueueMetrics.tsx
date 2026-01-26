import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getQueueMetricsData } from '../server/queues.functions'
import { MetricsCard } from './MetricsCard'
import { TimeRangeSelector } from './TimeRangeSelector'

interface QueueMetricsProps {
  queueName: string
}

export function QueueMetrics({ queueName }: QueueMetricsProps) {
  const [timeRange, setTimeRange] = useState(60)

  const { data: completedMetrics } = useQuery({
    queryKey: ['metrics', queueName, 'completed', timeRange],
    queryFn: () =>
      getQueueMetricsData({
        data: { queueName, type: 'completed' as const, timeRange },
      }),
    refetchInterval: 1000,
    staleTime: 0,
  })

  const { data: failedMetrics } = useQuery({
    queryKey: ['metrics', queueName, 'failed', timeRange],
    queryFn: () =>
      getQueueMetricsData({
        data: { queueName, type: 'failed' as const, timeRange },
      }),
    refetchInterval: 1000,
    staleTime: 0,
  })

  const handleTimeRangeChange = (minutes: number) => {
    setTimeRange(minutes)
    // Queries will automatically refetch when timeRange changes
  }

  const calculateTrend = (current: number, previous: number) => {
    if (previous === 0) return undefined
    const change = ((current - previous) / previous) * 100
    return {
      value: Math.round(Math.abs(change)),
      isPositive: change > 0,
    }
  }

  const completedTrend = completedMetrics?.meta
    ? calculateTrend(completedMetrics.total, completedMetrics.meta.prevCount)
    : undefined

  const failedTrend = failedMetrics?.meta
    ? calculateTrend(failedMetrics.total, failedMetrics.meta.prevCount)
    : undefined

  const successRate =
    completedMetrics && failedMetrics
      ? completedMetrics.total + failedMetrics.total > 0
        ? (
            (completedMetrics.total /
              (completedMetrics.total + failedMetrics.total)) *
            100
          ).toFixed(1)
        : '100'
      : '0'

  const failureRate = 100 - parseFloat(successRate)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-2 py-1 bg-muted/30">
        <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          METRICS
        </span>
        <TimeRangeSelector onChange={handleTimeRangeChange} />
      </div>

      <div className="grid grid-cols-4 gap-3">
        <MetricsCard
          label="COMPLETED"
          value={completedMetrics?.total || 0}
          subtitle={`${(completedMetrics?.rate || 0).toFixed(1)}/min`}
          trend={completedTrend}
        />
        <MetricsCard
          label="FAILED"
          value={failedMetrics?.total || 0}
          subtitle={`${(failedMetrics?.rate || 0).toFixed(1)}/min`}
          trend={failedTrend}
          alert={failedMetrics && failedMetrics.total > 10}
        />
        <MetricsCard 
          label="SUCCESS RATE" 
          value={`${successRate}%`}
          alert={parseFloat(successRate) < 90}
        />
        <MetricsCard
          label="THROUGHPUT"
          value={`${((completedMetrics?.rate || 0) / 60).toFixed(2)}/s`}
          subtitle={`${(completedMetrics?.rate || 0).toFixed(1)}/min`}
        />
      </div>
    </div>
  )
}
