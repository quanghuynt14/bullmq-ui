import { Link } from '@tanstack/react-router'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'

interface StatusFilterProps {
  currentStatus: string
}

const statuses = [
  { value: 'latest', label: 'ALL' },
  { value: 'wait', label: 'WAIT' },
  { value: 'waiting-children', label: 'W-CH' },
  { value: 'active', label: 'ACT' },
  { value: 'completed', label: 'COMP' },
  { value: 'failed', label: 'FAIL' },
  { value: 'delayed', label: 'DELY' },
  { value: 'prioritized', label: 'PRIO' },
]

export default function StatusFilter({ currentStatus }: StatusFilterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const currentLabel = statuses.find((s) => s.value === currentStatus)?.label || 'ALL'

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="border border-border/50 bg-background px-3 py-1 text-xs font-mono uppercase hover:bg-muted/20 flex items-center gap-2"
      >
        {currentLabel}
        <ChevronDown className="h-3 w-3" />
      </button>
      
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-1 z-20 border border-border/50 bg-background shadow-lg min-w-[100px]">
            {statuses.map((status) => (
              <Link
                key={status.value}
                from="/queues/$queueName"
                search={(prev) => ({
                  ...prev,
                  status: status.value as any,
                  page: 1,
                })}
                onClick={() => setIsOpen(false)}
                className="block px-3 py-1.5 text-xs font-mono uppercase hover:bg-muted/20 border-b border-border/50 last:border-0"
              >
                {status.label}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
