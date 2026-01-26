import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { getSystemHealth } from '../server/health.functions'
import { Button } from './ui/button'
import type {
  Prediction,
  Recommendation,
} from '../server/health-monitor.functions'

const SEVERITY_CONFIG = {
  info: {
    borderColor: 'border-l-blue-500',
    severityColor: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-500/5',
  },
  warning: {
    borderColor: 'border-l-amber-500',
    severityColor: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-500/5',
  },
  critical: {
    borderColor: 'border-l-red-500',
    severityColor: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-500/5',
  },
} as const

const CONFIDENCE_LEVEL = { low: 'L', medium: 'M', high: 'H' } as const

const ACTION_LABELS: Record<string, string> = {
  scale_workers: 'Copy Scaling Guide',
  investigate: 'View Failed Jobs',
  pause_queue: 'Go to Queue',
  optimize: 'Review Active Jobs',
  alert_team: 'Copy Alert Details',
}

export function PredictiveInsights() {
  const { data: health } = useQuery({
    queryKey: ['system-health'],
    queryFn: () => getSystemHealth(),
    refetchInterval: 1000,
    staleTime: 0,
  })

  if (!health) {
    return <InsightsLoadingSkeleton />
  }

  const hasPredictions = health.predictions.length > 0
  const hasRecommendations = health.recommendations.length > 0

  if (!hasPredictions && !hasRecommendations) {
    return null
  }

  return (
    <div className="space-y-3">
      {hasPredictions && (
        <div>
          <div className="flex items-center gap-3 mb-2 px-2 py-1 bg-muted/30">
            <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              PREDICTIONS
            </span>
            <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
              [{health.predictions.length}]
            </span>
          </div>
          <div className="space-y-2">
            {health.predictions.map((prediction) => (
              <PredictionCard key={prediction.id} prediction={prediction} />
            ))}
          </div>
        </div>
      )}

      {hasRecommendations && (
        <div>
          <div className="flex items-center gap-3 mb-2 px-2 py-1 bg-muted/30">
            <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              ACTION REQUIRED
            </span>
            <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
              [{health.recommendations.length}]
            </span>
          </div>
          <div className="space-y-2">
            {health.recommendations.map((rec, index) => (
              <RecommendationCard key={index} recommendation={rec} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function PredictionCard({ prediction }: { prediction: Prediction }) {
  const navigate = useNavigate()

  const config = SEVERITY_CONFIG[prediction.severity]

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const handleAction = () => {
    const { actionType } = prediction.recommendation
    const { queueName } = prediction

    switch (actionType) {
      case 'scale_workers':
        copyToClipboard(
          `Queue: ${queueName}\nIssue: ${prediction.message}\nRecommendation: ${prediction.recommendation.action}\n${prediction.recommendation.description}\nExpected Impact: ${prediction.recommendation.estimatedImpact || 'N/A'}`
        )
        break

      case 'investigate':
        if (queueName) {
          navigate({
            to: '/queues/$queueName',
            params: { queueName },
            search: { status: 'failed', page: 1, pageSize: 25 },
          })
        }
        break

      case 'pause_queue':
      case 'optimize':
        if (queueName) {
          navigate({
            to: '/queues/$queueName',
            params: { queueName },
            ...(actionType === 'optimize' && {
              search: { status: 'active', page: 1, pageSize: 25 },
            }),
          })
        }
        break

      case 'alert_team':
        copyToClipboard(
          `🚨 ALERT: ${prediction.title}\n\nQueue: ${queueName || 'Multiple'}\nSeverity: ${prediction.severity.toUpperCase()}\nMessage: ${prediction.message}\n\nRecommended Action:\n${prediction.recommendation.action}\n${prediction.recommendation.description}\n\nTime to Impact: ${prediction.timeToImpact || 'Immediate'}\nAffected Jobs: ${prediction.affectedJobs || 'Unknown'}\nConfidence: ${prediction.confidence}`
        )
        break

      default:
        copyToClipboard(
          `${prediction.title}\n\n${prediction.message}\n\nRecommendation: ${prediction.recommendation.action}\n${prediction.recommendation.description}`
        )
    }
  }

  return (
    <div
      className={`border-l-2 ${config.borderColor} ${config.bg} border border-border/50 p-3`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-mono font-bold ${config.severityColor} uppercase`}>
            {prediction.severity}
          </span>
          <span className="text-[10px] font-mono text-muted-foreground">
            CONF:{CONFIDENCE_LEVEL[prediction.confidence]}
          </span>
          {prediction.queueName && (
            <span className="text-[10px] font-mono text-foreground border-l border-border/50 pl-2">
              {prediction.queueName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
          {prediction.timeToImpact && <span>T-{prediction.timeToImpact}</span>}
          {prediction.affectedJobs && (
            <span className="border-l border-border/50 pl-2">
              {prediction.affectedJobs}J
            </span>
          )}
        </div>
      </div>

      <div className="mb-2">
        <h4 className="text-sm font-mono font-bold text-foreground mb-1">
          {prediction.title}
        </h4>
        <p className="text-xs text-muted-foreground font-mono leading-relaxed">
          {prediction.message}
        </p>
      </div>

      <div className="pt-2 border-t border-border/50">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="text-xs font-mono font-bold text-foreground uppercase mb-1">
              {prediction.recommendation.action}
            </p>
            <p className="text-[10px] text-muted-foreground font-mono">
              {prediction.recommendation.description}
            </p>
            {prediction.recommendation.estimatedImpact && (
              <p className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                IMPACT: {prediction.recommendation.estimatedImpact}
              </p>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="text-[10px] font-mono h-7 px-2 shrink-0"
            onClick={handleAction}
          >
            {ACTION_LABELS[prediction.recommendation.actionType] || 'Take Action'}
            <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  )
}

function RecommendationCard({
  recommendation,
}: {
  recommendation: Recommendation
}) {
  return (
    <div className="border-l-2 border-l-blue-500 bg-blue-500/5 border border-border/50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-bold text-blue-600 dark:text-blue-400 uppercase">
              {recommendation.actionType.replace('_', ' ')}
            </span>
            {recommendation.automated && (
              <span className="text-[10px] font-mono bg-purple-500/20 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 border border-purple-500/30">
                AUTO
              </span>
            )}
          </div>
          <h4 className="text-xs font-mono font-bold text-foreground mb-1">
            {recommendation.action}
          </h4>
          <p className="text-[10px] font-mono text-muted-foreground">
            {recommendation.description}
          </p>
          {recommendation.estimatedImpact && (
            <p className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 mt-2">
              IMPACT: {recommendation.estimatedImpact}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function InsightsLoadingSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className="border-l-2 border-l-muted bg-muted/10 border border-border/50 p-3"
        >
          <div className="h-3 bg-muted/50 w-24 mb-2" />
          <div className="h-2 bg-muted/40 w-full mb-2" />
          <div className="h-2 bg-muted/40 w-2/3" />
        </div>
      ))}
    </div>
  )
}