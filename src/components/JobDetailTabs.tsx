import { useState } from 'react'

interface Job {
  id: string | undefined
  name: string
  data: any
  opts: any
  failedReason?: string
  stacktrace?: Array<string>
  returnvalue?: any
  logs?: Array<string>
}

interface JobDetailTabsProps {
  job: Job
}

export default function JobDetailTabs({ job }: JobDetailTabsProps) {
  const tabs = [
    { id: 'data', label: 'DATA' },
    { id: 'options', label: 'OPTS' },
    ...(job.logs && job.logs.length > 0 ? [{ id: 'logs', label: 'LOGS' }] : []),
    ...(job.failedReason ? [{ id: 'error', label: 'ERROR' }] : []),
    ...(job.returnvalue ? [{ id: 'result', label: 'RESULT' }] : []),
  ]
  
  const [activeTab, setActiveTab] = useState('data')

  return (
    <div>
      <div className="flex gap-1 mb-4">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`border border-border px-3 py-1 text-xs font-mono uppercase hover:bg-muted ${
              activeTab === tab.id ? 'bg-foreground text-background' : ''
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'data' && (
        <div className="border border-border bg-muted/10 p-3">
          <pre className="text-xs font-mono overflow-auto">
            {JSON.stringify(job.data, null, 2)}
          </pre>
        </div>
      )}

      {activeTab === 'options' && (
        <div className="border border-border bg-muted/10 p-3">
          <pre className="text-xs font-mono overflow-auto">
            {JSON.stringify(job.opts, null, 2)}
          </pre>
        </div>
      )}

      {activeTab === 'logs' && job.logs && (
        <div className="border border-border bg-muted/10 p-3">
          <div className="space-y-1">
            {job.logs.map((log, index) => (
              <div key={index} className="text-xs font-mono border-b border-border/50 pb-1">
                {log}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'error' && job.failedReason && (
        <div className="border border-border bg-red-500/10 p-3">
          <div className="text-xs font-mono text-red-600 dark:text-red-400 mb-3">
            {job.failedReason}
          </div>
          {job.stacktrace && job.stacktrace.length > 0 && (
            <pre className="text-[10px] font-mono text-muted-foreground overflow-auto">
              {job.stacktrace.join('\n')}
            </pre>
          )}
        </div>
      )}

      {activeTab === 'result' && job.returnvalue && (
        <div className="border border-border bg-emerald-500/10 p-3">
          <pre className="text-xs font-mono overflow-auto">
            {typeof job.returnvalue === 'string'
              ? job.returnvalue
              : JSON.stringify(job.returnvalue, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
