import { Link } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  currentPage: number
  totalPages: number
}

export default function Pagination({
  currentPage,
  totalPages,
}: PaginationProps) {
  const pages = []
  const maxVisible = 7

  if (totalPages <= maxVisible) {
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i)
    }
  } else {
    if (currentPage <= 4) {
      for (let i = 1; i <= 5; i++) pages.push(i)
      pages.push(-1)
      pages.push(totalPages)
    } else if (currentPage >= totalPages - 3) {
      pages.push(1)
      pages.push(-1)
      for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      pages.push(-1)
      for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i)
      pages.push(-1)
      pages.push(totalPages)
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Link
        from="/queues/$queueName"
        search={(prev) => ({ ...prev, page: Math.max(1, currentPage - 1) })}
        disabled={currentPage === 1}
      >
        <button
          className="border border-border/50 bg-background px-2 py-1 disabled:opacity-30 disabled:pointer-events-none hover:bg-muted/20"
          disabled={currentPage === 1}
        >
          <ChevronLeft className="h-3 w-3" />
        </button>
      </Link>

      {pages.map((page, idx) =>
        page === -1 ? (
          <span key={`ellipsis-${idx}`} className="px-1 text-xs font-mono text-muted-foreground">
            ...
          </span>
        ) : (
          <Link
            key={page}
            from="/queues/$queueName"
            search={(prev) => ({ ...prev, page })}
          >
            <button
              className={`border border-border/50 px-2 py-1 text-xs font-mono tabular-nums ${
                page === currentPage
                  ? 'bg-foreground text-background'
                  : 'bg-background hover:bg-muted/20'
              }`}
            >
              {page}
            </button>
          </Link>
        ),
      )}

      <Link
        from="/queues/$queueName"
        search={(prev) => ({
          ...prev,
          page: Math.min(totalPages, currentPage + 1),
        })}
        disabled={currentPage === totalPages}
      >
        <button
          className="border border-border/50 bg-background px-2 py-1 disabled:opacity-30 disabled:pointer-events-none hover:bg-muted/20"
          disabled={currentPage === totalPages}
        >
          <ChevronRight className="h-3 w-3" />
        </button>
      </Link>
    </div>
  )
}
