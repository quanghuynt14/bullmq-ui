import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { format } from 'date-fns'
import { useState } from 'react'
import { getJobDetail, removeJob, retryJob } from '../../server/queues.functions'
import JobDetailTabs from '../../components/JobDetailTabs'

export const Route = createFileRoute('/queues/jobs/$queueName/$jobId')({
  loader: async ({ params }) => {
    const { queueName, jobId } = params
    const job = await getJobDetail({
      data: { queueName, jobId },
    })
    return { job, queueName }
  },
  component: JobDetail,
})

function JobDetail() {
  const { job, queueName } = Route.useLoaderData()
  const router = useRouter()
  const [isRetrying, setIsRetrying] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  if (!job) {
    return (
      <div className="container mx-auto px-4 py-4">
        <div className="border border-border bg-red-500/10 p-4 font-mono text-xs">
          JOB NOT FOUND
        </div>
      </div>
    )
  }

  const handleRetry = async () => {
    setIsRetrying(true)
    try {
      await retryJob({ data: { queueName, jobId: String(job.id) } })
      router.invalidate()
      router.navigate({
        to: '/queues/$queueName',
        params: { queueName },
      })
    } catch (error) {
      console.error('Failed to retry job:', error)
    } finally {
      setIsRetrying(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await removeJob({ data: { queueName, jobId: String(job.id) } })
      setDeleteDialogOpen(false)
      router.navigate({
        to: '/queues/$queueName',
        params: { queueName },
      })
    } catch (error) {
      console.error('Failed to delete job:', error)
      setIsDeleting(false)
    }
  }

  const getStatusColor = (state: string) => {
    switch (state) {
      case 'completed':
        return 'border-emerald-500'
      case 'failed':
        return 'border-red-500'
      case 'active':
        return 'border-blue-500'
      case 'waiting':
        return 'border-amber-500'
      case 'delayed':
        return 'border-purple-500'
      default:
        return 'border-gray-500'
    }
  }

  const getStateLabel = (state: string) => {
    switch (state) {
      case 'completed': return 'COMP'
      case 'failed': return 'FAIL'
      case 'active': return 'ACTV'
      case 'waiting': return 'WAIT'
      case 'delayed': return 'DLAY'
      case 'waiting-children': return 'W-CH'
      default: return state.substring(0, 4).toUpperCase()
    }
  }

  return (
    <div className="container mx-auto px-4 py-4">
      <Link
        to="/queues/$queueName"
        params={{ queueName }}
        className="inline-block font-mono text-xs uppercase mb-4 border border-border px-2 py-1 hover:bg-muted"
      >
        ← {queueName}
      </Link>

      <div className={`border-l-2 ${getStatusColor(job.state)} border border-border bg-muted/20 p-4 mb-4`}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="font-mono font-bold text-lg mb-2">
              {job.name || 'UNNAMED'}
            </div>
            <div className="flex items-center gap-3 text-xs font-mono">
              <span>ID:{job.id}</span>
              <span>•</span>
              <span className="font-bold">{getStateLabel(job.state)}</span>
            </div>
          </div>

          <div className="flex gap-2">
            {job.state === 'failed' && (
              <button
                onClick={handleRetry}
                disabled={isRetrying}
                className="border border-border px-3 py-1 text-xs font-mono uppercase hover:bg-muted disabled:opacity-50"
              >
                {isRetrying ? 'RETRY...' : 'RETRY'}
              </button>
            )}
            
            <button
              onClick={() => setDeleteDialogOpen(true)}
              className="border border-border px-3 py-1 text-xs font-mono uppercase hover:bg-red-500 hover:text-white"
            >
              DEL
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
          <div>
            <div className="text-muted-foreground uppercase text-[10px] mb-1">ATTEMPTS</div>
            <div className="font-bold tabular-nums">{job.attemptsMade || 0}</div>
          </div>
          <div>
            <div className="text-muted-foreground uppercase text-[10px] mb-1">PROGRESS</div>
            <div className="font-bold tabular-nums">
              {typeof job.progress === 'number' 
                ? `${job.progress}%` 
                : typeof job.progress === 'string'
                ? job.progress
                : job.progress 
                ? JSON.stringify(job.progress)
                : '0%'}
            </div>
          </div>
          {job.timestamp && (
            <div>
              <div className="text-muted-foreground uppercase text-[10px] mb-1">CREATED</div>
              <div className="font-bold tabular-nums">
                {format(job.timestamp, 'HH:mm:ss')}
              </div>
              <div className="text-[9px] text-muted-foreground">
                {format(job.timestamp, 'yyyy-MM-dd')}
              </div>
            </div>
          )}
          {job.processedOn && (
            <div>
              <div className="text-muted-foreground uppercase text-[10px] mb-1">PROCESSED</div>
              <div className="font-bold tabular-nums">
                {format(job.processedOn, 'HH:mm:ss')}
              </div>
              <div className="text-[9px] text-muted-foreground">
                {format(job.processedOn, 'yyyy-MM-dd')}
              </div>
            </div>
          )}
        </div>
      </div>

      {deleteDialogOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setDeleteDialogOpen(false)}>
          <div className="border border-border bg-background p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="font-mono font-bold text-sm mb-2 uppercase">DELETE JOB</div>
            <div className="text-xs font-mono mb-4 text-muted-foreground">
              CONFIRM DELETE ID:{job.id}. CANNOT UNDO.
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteDialogOpen(false)}
                disabled={isDeleting}
                className="border border-border px-4 py-2 text-xs font-mono uppercase hover:bg-muted disabled:opacity-50"
              >
                CANCEL
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="border border-red-500 bg-red-500 text-white px-4 py-2 text-xs font-mono uppercase hover:bg-red-600 disabled:opacity-50"
              >
                {isDeleting ? 'DELETE...' : 'DELETE'}
              </button>
            </div>
          </div>
        </div>
      )}

      <JobDetailTabs job={job} />
    </div>
  )
}
