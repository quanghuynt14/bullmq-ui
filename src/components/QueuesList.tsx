import { useQuery } from '@tanstack/react-query'
import { getQueuesStatsWithMetrics } from '../server/queues.functions'
import QueueCard from './QueueCard'
import type { QueueStats } from '../server/queues.functions'

export function QueuesList() {
  const { data: queues = [], isLoading } = useQuery({
    queryKey: ['queues-stats'],
    queryFn: () => getQueuesStatsWithMetrics(),
    refetchInterval: 2000, // 2 seconds
    staleTime: 0, // Always fetch fresh data
    cacheTime: 0, // Don't cache results
    refetchOnMount: 'always', // Always refetch on mount
    refetchOnWindowFocus: true, // Refetch when window gains focus
  })

  if (isLoading) {
    return <div className="text-center text-muted-foreground py-8">Loading queues...</div>
  }

  if (queues.length === 0) {
    return (
      <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-6 text-center">
        <p className="text-yellow-700 dark:text-yellow-400 font-medium">No queues found</p>
        <p className="text-yellow-600 dark:text-yellow-500 text-sm mt-2">
          Queues will be automatically discovered from Redis when they are created.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {queues.map((queue: QueueStats) => (
        <QueueCard key={queue.name} queue={queue} />
      ))}
    </div>
  )
}
