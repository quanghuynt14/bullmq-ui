import type { QueueStats } from './queues.functions'

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type HealthStatus = 'healthy' | 'warning' | 'critical'
export type AlertSeverity = 'info' | 'warning' | 'critical'
export type PredictionConfidence = 'low' | 'medium' | 'high'

export interface HealthMetrics {
  timestamp: number
  queueName: string
  jobCounts: {
    waiting: number
    active: number
    completed: number
    failed: number
    delayed: number
  }
  throughput: {
    completed: number // jobs/min
    failed: number // jobs/min
  }
  processingRate: number // jobs/min
  failureRate: number // percentage
}

export interface Prediction {
  id: string
  type: 'backlog' | 'failure_spike' | 'slow_processing' | 'memory_pressure' | 'starvation'
  severity: AlertSeverity
  queueName?: string
  title: string
  message: string
  confidence: PredictionConfidence
  timeToImpact?: string // e.g., "8 minutes", "2 hours"
  affectedJobs?: number
  recommendation: Recommendation
}

export interface Recommendation {
  action: string
  description: string
  actionType: 'scale_workers' | 'pause_queue' | 'investigate' | 'optimize' | 'alert_team'
  automated: boolean
  estimatedImpact?: string
}

export interface SystemHealth {
  status: HealthStatus
  lastUpdated: number
  predictions: Array<Prediction>
  recommendations: Array<Recommendation>
  metrics: {
    healthyQueues: number
    warningQueues: number
    criticalQueues: number
  }
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SEVERITY_PRIORITY = {
  critical: 3,
  warning: 2,
  info: 1,
} as const

// Thresholds
const THRESHOLDS = {
  FAILURE_RATE_CRITICAL: 25,
  FAILURE_RATE_WARNING: 10,
  WAITING_JOBS_CRITICAL: 1000,
  WAITING_JOBS_WARNING: 100,
  WAITING_JOBS_HIGH: 50,
  WAITING_JOBS_STARVATION: 20,
  WAITING_JOBS_SLOW: 10,
  PROCESSING_RATE_LOW: 0.5,
  PROCESSING_RATE_SLOW: 1,
  BACKLOG_GROWTH_THRESHOLD: 5,
  BACKLOG_GROWTH_HIGH: 20,
  FAILURE_GROWTH_THRESHOLD: 50,
  FAILURE_RATE_SPIKE: 5,
  BACKLOG_CRITICAL_TIME: 10, // minutes
  HIGH_FAILURE_QUEUES_COUNT: 2,
  HIGH_FAILURE_RATE: 20,
  TOTAL_WAITING_THRESHOLD: 500,
  MIN_DATA_POINTS: 3,
  HISTORY_SAMPLE_SIZE: 3,
} as const

// ============================================================================
// HISTORICAL DATA STORE (In-memory for demo, use Redis/DB in production)
// ============================================================================

interface HistoricalDataPoint {
  timestamp: number
  metrics: HealthMetrics
}

const metricsHistory: Map<string, Array<HistoricalDataPoint>> = new Map()
const MAX_HISTORY_POINTS = 100 // Keep last 100 data points per queue

function recordMetrics(queueName: string, metrics: HealthMetrics): void {
  const history = metricsHistory.get(queueName) || []
  const timestamp = Date.now()
  history.push({ timestamp, metrics })
  
  // Keep only recent history - more efficient to slice than repeated shifts
  if (history.length > MAX_HISTORY_POINTS) {
    metricsHistory.set(queueName, history.slice(-MAX_HISTORY_POINTS))
  } else {
    metricsHistory.set(queueName, history)
  }
}

function getHistoricalMetrics(queueName: string, minutes: number = 5): Array<HistoricalDataPoint> {
  const history = metricsHistory.get(queueName)
  if (!history || history.length === 0) return []
  
  const cutoff = Date.now() - minutes * 60 * 1000
  // Since entries are chronological, we can optimize by finding first valid index
  let startIdx = history.length - 1
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].timestamp <= cutoff) break
    startIdx = i
  }
  return history.slice(startIdx)
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function calculateFailureRate(completed: number, failed: number): number {
  const total = completed + failed
  return total > 0 ? (failed / total) * 100 : 0
}

// ============================================================================
// PREDICTIVE ANALYSIS
// ============================================================================

function generatePredictions(queueName: string, current: HealthMetrics): Array<Prediction> {
  const history = getHistoricalMetrics(queueName, 10)
  if (history.length < THRESHOLDS.MIN_DATA_POINTS) {
    return [] // Not enough data
  }
  
  const predictions: Array<Prediction> = []
  
  // Pre-extract arrays to avoid repeated map operations
  const waitingCounts = new Array<number>(history.length)
  const failureRates = new Array<number>(history.length)
  for (let i = 0; i < history.length; i++) {
    waitingCounts[i] = history[i].metrics.jobCounts.waiting
    failureRates[i] = history[i].metrics.failureRate
  }

  // Predict backlog buildup
  const waitingGrowthRate = calculateGrowthRate(waitingCounts)

  if (waitingGrowthRate > THRESHOLDS.BACKLOG_GROWTH_THRESHOLD && 
      current.jobCounts.waiting > THRESHOLDS.WAITING_JOBS_HIGH) {
    const minutesToBacklog = current.processingRate > 0 
      ? Math.round(current.jobCounts.waiting / current.processingRate)
      : 999

    predictions.push({
      id: `pred-backlog-${queueName}`,
      type: 'backlog',
      severity: minutesToBacklog < THRESHOLDS.BACKLOG_CRITICAL_TIME ? 'critical' : 'warning',
      queueName,
      title: 'Queue Backlog Warning',
      message: `Queue will be significantly backed up in ~${minutesToBacklog} minutes`,
      confidence: waitingGrowthRate > THRESHOLDS.BACKLOG_GROWTH_HIGH ? 'high' : 'medium',
      timeToImpact: `${minutesToBacklog} minutes`,
      affectedJobs: current.jobCounts.waiting,
      recommendation: {
        action: 'Scale up workers',
        description: 'Add 2-3 more workers to increase processing capacity',
        actionType: 'scale_workers',
        automated: false,
        estimatedImpact: `Reduce backlog time by 50-70%`,
      },
    })
  }

  // Predict failure spike based on trend
  const failureGrowthRate = calculateGrowthRate(failureRates)

  if (failureGrowthRate > THRESHOLDS.FAILURE_GROWTH_THRESHOLD && 
      current.failureRate > THRESHOLDS.FAILURE_RATE_SPIKE) {
    predictions.push({
      id: `pred-failure-${queueName}`,
      type: 'failure_spike',
      severity: current.failureRate > THRESHOLDS.FAILURE_RATE_CRITICAL ? 'critical' : 'warning',
      queueName,
      title: 'Increasing Failure Rate',
      message: `Failures increased ${failureGrowthRate.toFixed(0)}% in last 5 minutes`,
      confidence: 'high',
      affectedJobs: Math.round(current.jobCounts.failed),
      recommendation: {
        action: 'Investigate recent failures',
        description: 'Check error logs and common failure patterns. May indicate external service issues.',
        actionType: 'investigate',
        automated: false,
        estimatedImpact: 'Identify root cause and prevent further failures',
      },
    })
  }

  // Predict worker starvation (jobs waiting but no active workers)
  if (current.jobCounts.waiting > THRESHOLDS.WAITING_JOBS_STARVATION && 
      current.jobCounts.active === 0) {
    predictions.push({
      id: `pred-starvation-${queueName}`,
      type: 'starvation',
      severity: 'critical',
      queueName,
      title: 'No Active Workers',
      message: `${current.jobCounts.waiting} jobs waiting but no workers processing`,
      confidence: 'high',
      timeToImpact: 'immediate',
      affectedJobs: current.jobCounts.waiting,
      recommendation: {
        action: 'Start workers immediately',
        description: 'Queue has jobs but no workers are running. Start at least 2 workers.',
        actionType: 'alert_team',
        automated: false,
        estimatedImpact: 'Resume job processing',
      },
    })
  }

  // Predict slow processing issues
  if (current.processingRate < THRESHOLDS.PROCESSING_RATE_SLOW && 
      current.jobCounts.waiting > THRESHOLDS.WAITING_JOBS_SLOW) {
    predictions.push({
      id: `pred-slow-${queueName}`,
      type: 'slow_processing',
      severity: 'warning',
      queueName,
      title: 'Slow Processing Detected',
      message: `Processing rate is ${current.processingRate.toFixed(1)}/min with ${current.jobCounts.waiting} waiting`,
      confidence: 'medium',
      affectedJobs: current.jobCounts.waiting,
      recommendation: {
        action: 'Optimize job handlers',
        description: 'Review job processing logic for performance bottlenecks or increase worker concurrency.',
        actionType: 'optimize',
        automated: false,
        estimatedImpact: 'Increase throughput by 2-3x',
      },
    })
  }

  return predictions
}

function calculateGrowthRate(values: Array<number>): number {
  const len = values.length
  if (len < THRESHOLDS.MIN_DATA_POINTS) return 0
  
  // Use fixed sample size for consistency
  const sampleSize = Math.min(THRESHOLDS.HISTORY_SAMPLE_SIZE, Math.floor(len / 2))
  const recentStart = len - sampleSize
  const olderEnd = len - sampleSize
  
  if (olderEnd === 0) return 0
  
  // Calculate averages without creating intermediate arrays
  let recentSum = 0
  let olderSum = 0
  
  for (let i = 0; i < olderEnd; i++) {
    olderSum += values[i]
  }
  for (let i = recentStart; i < len; i++) {
    recentSum += values[i]
  }
  
  const recentAvg = recentSum / sampleSize
  const olderAvg = olderSum / olderEnd
  
  if (olderAvg === 0) return recentAvg > 0 ? 100 : 0
  
  return ((recentAvg - olderAvg) / olderAvg) * 100
}

// ============================================================================
// HEALTH STATUS
// ============================================================================

function determineHealthStatus(stats: QueueStats): HealthStatus {
  const failureRate = calculateFailureRate(stats.counts.completed, stats.counts.failed)
  
  // Critical conditions
  if (stats.isPaused) return 'critical'
  if (failureRate > THRESHOLDS.FAILURE_RATE_CRITICAL) return 'critical'
  if (stats.counts.wait > THRESHOLDS.WAITING_JOBS_CRITICAL) return 'critical'
  
  // Warning conditions
  if (failureRate > THRESHOLDS.FAILURE_RATE_WARNING) return 'warning'
  if (stats.counts.wait > THRESHOLDS.WAITING_JOBS_WARNING) return 'warning'
  if (stats.throughput && 
      stats.throughput.completed < THRESHOLDS.PROCESSING_RATE_LOW && 
      stats.counts.wait > THRESHOLDS.WAITING_JOBS_SLOW) return 'warning'
  
  return 'healthy'
}

function determineSystemHealthStatus(
  healthyCount: number,
  warningCount: number,
  criticalCount: number
): HealthStatus {
  if (criticalCount > 0) return 'critical'
  if (warningCount > 0) return 'warning'
  return 'healthy'
}

// ============================================================================
// PREDICTION FILTERING
// ============================================================================

/**
 * Filter predictions to show only the highest severity prediction per queue
 * This prevents cluttering the UI with multiple predictions for the same queue
 */
function getHighestSeverityPredictionPerQueue(
  predictions: Array<Prediction>
): Array<Prediction> {
  if (predictions.length === 0) return []
  
  const queueMap = new Map<string, Prediction>()

  for (const prediction of predictions) {
    const queueKey = prediction.queueName || 'global'
    const existing = queueMap.get(queueKey)
    const currentPriority = SEVERITY_PRIORITY[prediction.severity]

    if (!existing || currentPriority > SEVERITY_PRIORITY[existing.severity]) {
      queueMap.set(queueKey, prediction)
    }
  }

  return Array.from(queueMap.values())
}

// ============================================================================
// MAIN HEALTH ANALYSIS FUNCTION
// ============================================================================

export function analyzeSystemHealth(
  queuesStats: Array<QueueStats>
): SystemHealth {
  if (queuesStats.length === 0) {
    return {
      status: 'healthy',
      lastUpdated: Date.now(),
      predictions: [],
      recommendations: [],
      metrics: {
        healthyQueues: 0,
        warningQueues: 0,
        criticalQueues: 0,
      },
    }
  }
  
  const allPredictions: Array<Prediction> = []
  const allRecommendations: Array<Recommendation> = []
  const timestamp = Date.now()
  
  let healthyCount = 0
  let warningCount = 0
  let criticalCount = 0

  // Analyze each queue in a single pass
  for (const stats of queuesStats) {
    const failureRate = calculateFailureRate(stats.counts.completed, stats.counts.failed)
    
    const metrics: HealthMetrics = {
      timestamp,
      queueName: stats.name,
      jobCounts: {
        waiting: stats.counts.wait,
        active: stats.counts.active,
        completed: stats.counts.completed,
        failed: stats.counts.failed,
        delayed: stats.counts.delayed,
      },
      throughput: {
        completed: stats.throughput?.completed || 0,
        failed: stats.throughput?.failed || 0,
      },
      processingRate: stats.throughput?.completed || 0,
      failureRate,
    }

    // Record metrics for historical analysis
    recordMetrics(stats.name, metrics)

    // Generate predictions
    const predictions = generatePredictions(stats.name, metrics)
    if (predictions.length > 0) {
      allPredictions.push(...predictions)
    }

    // Determine health status
    const status = determineHealthStatus(stats)
    if (status === 'healthy') healthyCount++
    else if (status === 'warning') warningCount++
    else criticalCount++
  }

  // Generate system-wide recommendations
  const systemRecommendations = generateSystemRecommendations(
    queuesStats,
    allPredictions
  )
  allRecommendations.push(...systemRecommendations)

  const systemStatus = determineSystemHealthStatus(healthyCount, warningCount, criticalCount)

  // Filter predictions to show only highest severity per queue
  const filteredPredictions = getHighestSeverityPredictionPerQueue(allPredictions)

  return {
    status: systemStatus,
    lastUpdated: timestamp,
    predictions: filteredPredictions,
    recommendations: allRecommendations,
    metrics: {
      healthyQueues: healthyCount,
      warningQueues: warningCount,
      criticalQueues: criticalCount,
    },
  }
}

function generateSystemRecommendations(
  queuesStats: Array<QueueStats>,
  predictions: Array<Prediction>
): Array<Recommendation> {
  const recommendations: Array<Recommendation> = []

  // Recommend if multiple queues have high failure rates
  let highFailureCount = 0
  let totalWaiting = 0
  
  for (const stats of queuesStats) {
    const rate = calculateFailureRate(stats.counts.completed, stats.counts.failed)
    if (rate > THRESHOLDS.HIGH_FAILURE_RATE) {
      highFailureCount++
    }
    totalWaiting += stats.counts.wait
  }

  if (highFailureCount >= THRESHOLDS.HIGH_FAILURE_QUEUES_COUNT) {
    recommendations.push({
      action: 'System-wide issue detected',
      description: `${highFailureCount} queues have high failure rates. Check external dependencies (database, API services).`,
      actionType: 'investigate',
      automated: false,
      estimatedImpact: 'Identify and resolve common root cause',
    })
  }

  // Recommend if critical predictions exist
  let criticalCount = 0
  for (const prediction of predictions) {
    if (prediction.severity === 'critical') {
      criticalCount++
    }
  }
  
  if (criticalCount > 0) {
    recommendations.push({
      action: 'Immediate attention required',
      description: `${criticalCount} critical issue(s) detected. Review predictions and take action.`,
      actionType: 'alert_team',
      automated: false,
      estimatedImpact: 'Prevent system degradation',
    })
  }

  // Recommend capacity planning (totalWaiting already computed above)
  if (totalWaiting > THRESHOLDS.TOTAL_WAITING_THRESHOLD) {
    recommendations.push({
      action: 'Scale infrastructure',
      description: `${totalWaiting} jobs waiting across all queues. Consider adding more workers or horizontal scaling.`,
      actionType: 'scale_workers',
      automated: false,
      estimatedImpact: 'Reduce wait times by 60-80%',
    })
  }

  return recommendations
}
