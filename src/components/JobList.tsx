import { useNavigate } from '@tanstack/react-router'
import { formatDistanceToNow } from 'date-fns'

interface Job {
  id: string | undefined
  name: string
  timestamp?: number
  progress?: number | string | object
  attemptsMade?: number
  failedReason?: string
  state?: string
}

interface JobListProps {
  jobs: Array<Job>
  queueName: string
}

export default function JobList({ jobs, queueName }: JobListProps) {
  const navigate = useNavigate()
  const getStateConfig = (job: Job) => {
    const state = job.state

    switch (state) {
      case 'completed':
        return { label: 'COMP', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' }
      case 'failed':
        return { label: 'FAIL', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10' }
      case 'active':
        return { label: 'ACT', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10' }
      case 'waiting':
      case 'wait':
        return { label: 'WAIT', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10' }
      case 'delayed':
        return { label: 'DELY', color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-500/10' }
      case 'paused':
        return { label: 'PAUS', color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-500/10' }
      case 'waiting-children':
        return { label: 'W-CH', color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-500/10' }
      default:
        if (job.failedReason) {
          return { label: 'FAIL', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10' }
        }
        if (job.progress === 100) {
          return { label: 'COMP', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' }
        }
        if (job.progress && typeof job.progress === 'number' && job.progress > 0) {
          return { label: 'ACT', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10' }
        }
        return { label: 'WAIT', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10' }
    }
  }

  if (jobs.length === 0) {
    return (
      <div className="border border-border/50 bg-muted/10 px-4 py-6 text-center">
        <p className="text-xs font-mono text-muted-foreground uppercase">NO JOBS</p>
      </div>
    )
  }

  return (
    <div className="border border-border/50 bg-background overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-12 gap-3 px-3 py-2 bg-muted/30 border-b border-border/50">
        <div className="col-span-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">ID</div>
        <div className="col-span-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">NAME</div>
        <div className="col-span-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">STATE</div>
        <div className="col-span-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">PROGRESS</div>
        <div className="col-span-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">ATT</div>
        <div className="col-span-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">CREATED</div>
      </div>
      
      {/* Rows */}
      <div>
        {jobs.map((job) => {
          const stateConfig = getStateConfig(job)
          return (
            <div
              key={job.id}
              className="grid grid-cols-12 gap-3 px-3 py-2 border-b border-border/50 hover:bg-muted/20 transition-colors"
            >
              <div className="col-span-2">
                <button
                  onClick={async () => {
                    await navigate({
                      to: '/queues/jobs/$queueName/$jobId',
                      params: { queueName, jobId: String(job.id) }
                    })
                  }}
                  className="text-xs font-mono text-blue-600 dark:text-blue-400 hover:underline cursor-pointer text-left"
                >
                  {String(job.id).substring(0, 12)}
                </button>
              </div>
              <div className="col-span-3 text-xs font-mono text-foreground truncate">
                {job.name || '-'}
              </div>
              <div className="col-span-1">
                <span
                  className={`text-[10px] font-mono font-bold ${stateConfig.color} ${stateConfig.bg} px-1.5 py-0.5 border border-current/20`}
                >
                  {stateConfig.label}
                </span>
              </div>
              <div className="col-span-2 text-xs font-mono tabular-nums text-foreground">
                {typeof job.progress === 'number' ? `${job.progress}%` : '-'}
              </div>
              <div className="col-span-1 text-xs font-mono tabular-nums text-foreground">
                {job.attemptsMade || 0}
              </div>
              <div className="col-span-3 text-[10px] font-mono text-muted-foreground">
                {job.timestamp
                  ? formatDistanceToNow(job.timestamp, { addSuffix: true }).toUpperCase().replace(' AGO', '')
                  : '-'}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
