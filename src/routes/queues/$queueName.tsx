import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { Suspense, useState } from 'react'
import { getQueueJobs, getQueuesStatsWithMetrics, pauseQueue, resumeQueue } from '../../server/queues.functions'
import JobList from '../../components/JobList'
import StatusFilter from '../../components/StatusFilter'
import { QueueMetrics } from '../../components/QueueMetrics'
import type { JobStatus } from '../../server/bullmq.server'

const searchSchema = z.object({
  status: z
    .enum(['latest', 'active', 'wait', 'completed', 'failed', 'delayed', 'waiting-children', 'prioritized'])
    .default('latest'),
  page: z.number().default(1),
  pageSize: z.number().default(10),
})

export const Route = createFileRoute('/queues/$queueName')({
  validateSearch: searchSchema,
  loader: async ({ params }) => {
    const stats = await getQueuesStatsWithMetrics()
    return { queueStats: stats.find(s => s.name === params.queueName) }
  },
  component: QueueDetail,
})

function QueueDetail() {
  const { queueName } = Route.useParams()
  const search = Route.useSearch()
  const router = useRouter()
  const { queueStats: initialStats } = Route.useLoaderData()
  const [isPausing, setIsPausing] = useState(false)
  const [isResuming, setIsResuming] = useState(false)

  const { data } = useQuery({
    queryKey: ['queue-jobs', queueName, search.status, search.page, search.pageSize],
    queryFn: () => getQueueJobs({
      data: {
        queueName,
        status: search.status as JobStatus,
        page: search.page,
        pageSize: search.pageSize,
      },
    }),
    refetchInterval: 1000,
    staleTime: 0,
  })

  const jobs = data?.jobs || []
  const pagination = data?.pagination || { page: 1, pageSize: 10, total: 0, totalPages: 0 }

  const { data: queueStats = initialStats } = useQuery({
    queryKey: ['queue-stats', queueName],
    queryFn: async () => {
      const stats = await getQueuesStatsWithMetrics()
      return stats.find(s => s.name === queueName)
    },
    refetchInterval: 1000,
    staleTime: 0,
    initialData: initialStats,
  })

  const handlePause = async () => {
    setIsPausing(true)
    try {
      await pauseQueue({ data: { queueName } })
      router.invalidate()
    } catch (error) {
      console.error('Failed to pause queue:', error)
    } finally {
      setIsPausing(false)
    }
  }

  const handleResume = async () => {
    setIsResuming(true)
    try {
      await resumeQueue({ data: { queueName } })
      router.invalidate()
    } catch (error) {
      console.error('Failed to resume queue:', error)
    } finally {
      setIsResuming(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-4">
      <div className="mb-4">
        <Link to="/" className="inline-block font-mono text-xs uppercase mb-3 border border-border px-2 py-1 hover:bg-muted">
          ← DASHBOARD
        </Link>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-mono font-bold uppercase">{queueName}</h1>
            <p className="text-muted-foreground text-xs font-mono mt-1 tabular-nums">
              {pagination.total} JOBS
            </p>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={handlePause}
              disabled={isPausing}
              className="border border-border px-3 py-1 text-xs font-mono uppercase hover:bg-muted disabled:opacity-50"
            >
              {isPausing ? 'PAUSE...' : 'PAUSE'}
            </button>
            <button
              onClick={handleResume}
              disabled={isResuming}
              className="border border-border px-3 py-1 text-xs font-mono uppercase hover:bg-muted disabled:opacity-50"
            >
              {isResuming ? 'RESUME...' : 'RESUME'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        <div className="border border-border bg-muted/20 px-3 py-2">
          <div className="text-lg font-mono font-bold tabular-nums">{queueStats?.counts.wait || 0}</div>
          <div className="text-[9px] text-muted-foreground font-mono uppercase tracking-wider">WAIT</div>
        </div>
        <div className="border border-border bg-muted/20 px-3 py-2">
          <div className="text-lg font-mono font-bold tabular-nums">{queueStats?.counts.active || 0}</div>
          <div className="text-[9px] text-muted-foreground font-mono uppercase tracking-wider">ACTIVE</div>
        </div>
        <div className="border border-border bg-muted/20 px-3 py-2">
          <div className="text-lg font-mono font-bold tabular-nums">{queueStats?.counts.completed || 0}</div>
          <div className="text-[9px] text-muted-foreground font-mono uppercase tracking-wider">COMPLETED</div>
        </div>
        <div className="border border-border bg-muted/20 px-3 py-2">
          <div className={`text-lg font-mono font-bold tabular-nums ${(queueStats?.counts.failed || 0) > 10 ? 'text-red-500' : ''}`}>{queueStats?.counts.failed || 0}</div>
          <div className="text-[9px] text-muted-foreground font-mono uppercase tracking-wider">FAILED</div>
        </div>
        <div className="border border-border bg-muted/20 px-3 py-2">
          <div className="text-lg font-mono font-bold tabular-nums">{queueStats?.counts.delayed || 0}</div>
          <div className="text-[9px] text-muted-foreground font-mono uppercase tracking-wider">DELAYED</div>
        </div>
        <div className="border border-border bg-muted/20 px-3 py-2">
          <div className="text-lg font-mono font-bold tabular-nums">{queueStats?.counts['waiting-children'] || 0}</div>
          <div className="text-[9px] text-muted-foreground font-mono uppercase tracking-wider">W-CH</div>
        </div>
      </div>

      <div className="mb-4">
        <Suspense fallback={<div className="text-center text-muted-foreground font-mono text-xs py-4">LOADING...</div>}>
          <QueueMetrics queueName={queueName} />
        </Suspense>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <StatusFilter currentStatus={search.status} />
        
        <div className="text-xs font-mono text-muted-foreground tabular-nums">
          PG {pagination.page}/{pagination.totalPages}
        </div>
      </div>

      <JobList jobs={jobs} queueName={queueName} />

      {pagination.totalPages > 1 && (
        <div className="mt-4 flex justify-center gap-1">
          {pagination.page > 1 && (
            <Link
              to="/queues/$queueName"
              params={{ queueName }}
              search={{ ...search, page: pagination.page - 1 }}
              className="border border-border px-3 py-1 text-xs font-mono hover:bg-muted"
            >
              ←
            </Link>
          )}
          
          {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => {
            let pageNum: number
            if (pagination.totalPages <= 5) {
              pageNum = i + 1
            } else if (pagination.page <= 3) {
              pageNum = i + 1
            } else if (pagination.page >= pagination.totalPages - 2) {
              pageNum = pagination.totalPages - 4 + i
            } else {
              pageNum = pagination.page - 2 + i
            }
            
            return (
              <Link
                key={pageNum}
                to="/queues/$queueName"
                params={{ queueName }}
                search={{ ...search, page: pageNum }}
                className={`border border-border px-3 py-1 text-xs font-mono tabular-nums hover:bg-muted ${
                  pageNum === pagination.page ? 'bg-foreground text-background' : ''
                }`}
              >
                {pageNum}
              </Link>
            )
          })}
          
          {pagination.page < pagination.totalPages && (
            <Link
              to="/queues/$queueName"
              params={{ queueName }}
              search={{ ...search, page: pagination.page + 1 }}
              className="border border-border px-3 py-1 text-xs font-mono hover:bg-muted"
            >
              →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
