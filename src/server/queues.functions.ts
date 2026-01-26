import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  getJobsByStatus,
  getQueue,
  getQueueMetrics,
  getQueueNames
} from './bullmq.server'
import type {JobStatus} from './bullmq.server';

/**
 * Global metrics interface
 */
export interface GlobalMetrics {
  queueCount: number
  jobCounts: {
    wait: number
    active: number
    completed: number
    failed: number
    delayed: number
    total: number
  }
  throughput: {
    completed: number // jobs per minute across all queues
    failed: number
  }
  history: Array<{
    timestamp: number
    completed: number
    failed: number
  }>
}

/**
 * Queue statistics interface
 */
export interface QueueStats {
  name: string
  counts: {
    wait: number
    'waiting-children': number
    active: number
    completed: number
    failed: number
    delayed: number
  }
  isPaused: boolean
  throughput?: {
    completed: number // jobs per minute
    failed: number
  }
  lastUpdated?: string // ISO timestamp
}

/**
 * Get statistics for all queues
 */
export const getQueuesStats = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Array<QueueStats>> => {
    const queueNames = await getQueueNames()

    const stats = await Promise.all(
      queueNames.map(async (name) => {
        const queue = getQueue(name)
        const [counts, isPaused, prioritizedJobs] = await Promise.all([
          queue.getJobCounts(), // Get all counts without filtering
          queue.isPaused(),
          queue.getPrioritized(0, -1), // Get all prioritized jobs to count them
        ])

        return {
          name,
          counts: {
            wait: (counts.waiting || 0) + prioritizedJobs.length, // wait = waiting + prioritized
            'waiting-children': counts['waiting-children'] || 0,
            active: counts.active || 0,
            completed: counts.completed || 0,
            failed: counts.failed || 0,
            delayed: counts.delayed || 0,
          },
          isPaused,
        }
      }),
    )

    return stats
  },
)

/**
 * Get queue statistics with real-time metrics
 */
export const getQueuesStatsWithMetrics = createServerFn({ 
  method: 'GET'
}).handler(
  async ({ request }): Promise<Array<QueueStats>> => {
    // Add no-cache headers to prevent service worker/browser caching
    if (request) {
      const headers = new Headers()
      headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
      headers.set('Pragma', 'no-cache')
      headers.set('Expires', '0')
    }
    
    const queueNames = await getQueueNames()
    const now = new Date().toISOString()

    const stats = await Promise.all(
      queueNames.map(async (name) => {
        const queue = getQueue(name)
        
        // Get basic counts and metrics in parallel
        const [counts, isPaused, prioritizedJobs, completedMetrics, failedMetrics] = await Promise.all([
          queue.getJobCounts(), // Get all counts without filtering
          queue.isPaused(),
          queue.getPrioritized(0, -1),
          getQueueMetrics(name, 'completed', 60).catch(() => ({ total: 0, rate: 0, dataPoints: [], meta: { count: 0, prevCount: 0 } })),
          getQueueMetrics(name, 'failed', 60).catch(() => ({ total: 0, rate: 0, dataPoints: [], meta: { count: 0, prevCount: 0 } })),
        ])

        return {
          name,
          counts: {
            wait: (counts.waiting || 0) + prioritizedJobs.length,
            'waiting-children': counts['waiting-children'] || 0,
            active: counts.active || 0,
            completed: counts.completed || 0,
            failed: counts.failed || 0,
            delayed: counts.delayed || 0,
          },
          isPaused,
          throughput: {
            completed: completedMetrics.rate,
            failed: failedMetrics.rate,
          },
          lastUpdated: now,
        }
      })
    )

    return stats
  },
)

/**
 * Get metrics data for a queue
 */
export const getQueueMetricsData = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({
      queueName: z.string(),
      type: z.enum(['completed', 'failed']),
      timeRange: z.number().default(60),
    })
  )
  .handler(async ({ data }) => {
    return await getQueueMetrics(data.queueName, data.type, data.timeRange)
  })

/**
 * Get jobs for a specific queue and status
 */
export const getQueueJobs = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({
      queueName: z.string(),
      status: z.enum([
        'latest',
        'wait',
        'waiting-children',
        'active',
        'completed',
        'failed',
        'delayed',
        'prioritized',
      ]),
      page: z.number().default(1),
      pageSize: z.number().default(25),
    }),
  )
  .handler(async ({ data }) => {
    const { queueName, status, page, pageSize } = data
    const start = (page - 1) * pageSize
    const end = start + pageSize - 1

    const jobs = await getJobsByStatus(queueName, status as JobStatus, start, end)

    // Get total count for pagination
    const queue = getQueue(queueName)
    const counts = await queue.getJobCounts(
      'waiting',
      'waiting-children',
      'active',
      'completed',
      'failed',
      'delayed',
    )

    let total = 0
    if (status === 'latest') {
      total = Object.values(counts).reduce((sum, count) => sum + count, 0)
    } else if (status === 'prioritized') {
      // For prioritized, get count from getPrioritized
      const prioritizedJobs = await queue.getPrioritized(0, 0)
      total = prioritizedJobs.length
    } else if (status === 'wait') {
      // 'wait' = waiting + prioritized (BullMQ stores them separately)
      const prioritizedJobs = await queue.getPrioritized(0, 0)
      total = (counts.waiting || 0) + prioritizedJobs.length
    } else {
      total = counts[status as keyof typeof counts] || 0
    }

    // Get actual state for each job
    const jobsWithState = await Promise.all(
      jobs.map(async (job) => {
        const state = await job.getState()
        return {
          id: job.id,
          name: job.name,
          data: job.data,
          opts: job.opts,
          progress: job.progress as number | string | object | undefined,
          attemptsMade: job.attemptsMade,
          failedReason: job.failedReason,
          stacktrace: job.stacktrace,
          returnvalue: job.returnvalue,
          finishedOn: job.finishedOn,
          processedOn: job.processedOn,
          timestamp: job.timestamp,
          state, // Add actual job state
        }
      })
    )

    return {
      jobs: jobsWithState,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    }
  })

/**
 * Get a single job detail
 */
export const getJobDetail = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({
      queueName: z.string(),
      jobId: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    const { queueName, jobId } = data
    const queue = getQueue(queueName)
    const job = await queue.getJob(jobId)

    if (!job) {
      throw new Error(`Job ${jobId} not found in queue ${queueName}`)
    }

    const state = await job.getState()
    const logs = await queue.getJobLogs(jobId)

    return {
      id: job.id,
      name: job.name,
      data: job.data,
      opts: job.opts,
      progress: job.progress,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
      stacktrace: job.stacktrace,
      returnvalue: job.returnvalue,
      finishedOn: job.finishedOn,
      processedOn: job.processedOn,
      timestamp: job.timestamp,
      state,
      logs: logs.logs,
    }
  })

/**
 * Retry a failed job
 */
export const retryJob = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      queueName: z.string(),
      jobId: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    const { queueName, jobId } = data
    const queue = getQueue(queueName)
    const job = await queue.getJob(jobId)

    if (!job) {
      throw new Error(`Job ${jobId} not found`)
    }

    await job.retry()
    return { success: true, jobId }
  })

/**
 * Remove a job
 */
export const removeJob = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      queueName: z.string(),
      jobId: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    const { queueName, jobId } = data
    const queue = getQueue(queueName)
    const job = await queue.getJob(jobId)

    if (!job) {
      throw new Error(`Job ${jobId} not found`)
    }

    await job.remove()
    return { success: true, jobId }
  })

/**
 * Time range configuration for metrics
 */
export const TIME_RANGES = {
  '1h': { minutes: 60, buckets: 20, label: '1 Hour' },
  '4h': { minutes: 240, buckets: 24, label: '4 Hours' },
  '24h': { minutes: 1440, buckets: 24, label: '24 Hours' },
  '2d': { minutes: 2880, buckets: 24, label: '2 Days' },
  '7d': { minutes: 10080, buckets: 28, label: '7 Days' },
} as const

export type TimeRangeKey = keyof typeof TIME_RANGES

/**
 * Get global metrics across all queues
 */
export const getGlobalMetrics = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({
      timeRange: z.enum(['1h', '4h', '24h', '2d', '7d']).optional().default('1h'),
    }).optional()
  )
  .handler(
  async ({ data }): Promise<GlobalMetrics> => {
    const timeRangeKey: TimeRangeKey = data?.timeRange || '1h'
    const timeRangeConfig = TIME_RANGES[timeRangeKey]
    const queueNames = await getQueueNames()
    
    // Get all queue stats and metrics in parallel
    const allQueuesData = await Promise.all(
      queueNames.map(async (name) => {
        const queue = getQueue(name)
        const [counts, prioritizedJobs, completedMetrics, failedMetrics] = await Promise.all([
          queue.getJobCounts(), // Get all counts without filtering
          queue.getPrioritized(0, -1),
          getQueueMetrics(name, 'completed', timeRangeConfig.minutes).catch(() => ({ 
            total: 0, 
            rate: 0, 
            dataPoints: [], 
            meta: { count: 0, prevCount: 0 } 
          })),
          getQueueMetrics(name, 'failed', timeRangeConfig.minutes).catch(() => ({ 
            total: 0, 
            rate: 0, 
            dataPoints: [], 
            meta: { count: 0, prevCount: 0 } 
          })),
        ])
        
        return {
          counts: {
            wait: (counts.waiting || 0) + prioritizedJobs.length,
            active: counts.active || 0,
            completed: counts.completed || 0,
            failed: counts.failed || 0,
            delayed: counts.delayed || 0,
          },
          completedMetrics,
          failedMetrics,
        }
      })
    )
    
    // Aggregate counts
    const jobCounts = allQueuesData.reduce((acc, queueData) => ({
      wait: acc.wait + queueData.counts.wait,
      active: acc.active + queueData.counts.active,
      completed: acc.completed + queueData.counts.completed,
      failed: acc.failed + queueData.counts.failed,
      delayed: acc.delayed + queueData.counts.delayed,
      total: acc.total + queueData.counts.wait + queueData.counts.active + 
             queueData.counts.completed + queueData.counts.failed + queueData.counts.delayed,
    }), { wait: 0, active: 0, completed: 0, failed: 0, delayed: 0, total: 0 })
    
    // Aggregate throughput
    const throughput = allQueuesData.reduce((acc, queueData) => ({
      completed: acc.completed + queueData.completedMetrics.rate,
      failed: acc.failed + queueData.failedMetrics.rate,
    }), { completed: 0, failed: 0 })
    
    // Create history data with dynamic buckets based on time range
    // BullMQ gives us 1-minute data points, we aggregate them into buckets
    const now = Date.now()
    const numBuckets = timeRangeConfig.buckets
    const totalMinutes = timeRangeConfig.minutes
    const bucketSizeMinutes = Math.ceil(totalMinutes / numBuckets)
    
    // Initialize buckets covering the time range
    // Bucket 0 = oldest (leftmost), last bucket = most recent (rightmost)
    const buckets: Array<{ timestamp: number, completed: number, failed: number }> = []
    for (let i = 0; i < numBuckets; i++) {
      // i=0 should be the oldest time, i=numBuckets-1 should be the newest
      // Calculate the END time of this bucket for display
      // Bucket i covers from (totalMinutes - i*bucketSize - bucketSize) to (totalMinutes - i*bucketSize) minutes ago
      const minutesAgoEnd = totalMinutes - (i * bucketSizeMinutes) - bucketSizeMinutes
      const bucketTime = now - (minutesAgoEnd * 60 * 1000)
      buckets.push({ timestamp: bucketTime, completed: 0, failed: 0 })
    }
    
    // Aggregate data from all queues into the appropriate buckets
    // BullMQ dataPoints: index = minutes ago (index 0 = now, index 59 = 59 min ago)
    // Buckets: bucket 0 = oldest (left), bucket N-1 = newest (right)
    // Mapping: Use the timestamp from each point to determine which bucket it belongs to
    allQueuesData.forEach(queueData => {
      // Process completed metrics - map 1-minute points to buckets based on timestamp
      queueData.completedMetrics.dataPoints.forEach((point) => {
        // Calculate how many minutes ago this point is from now
        const minutesAgo = Math.floor((now - point.timestamp) / (60 * 1000))
        
        // Map minutes ago to bucket index
        // minutesAgo 0-2 (most recent) → bucket 19 (rightmost) 
        // minutesAgo 57-59 (oldest) → bucket 0 (leftmost)
        const bucketIndex = Math.floor((totalMinutes - minutesAgo - 1) / bucketSizeMinutes)
        
        if (bucketIndex >= 0 && bucketIndex < numBuckets && minutesAgo < totalMinutes) {
          buckets[bucketIndex].completed += point.value
        }
      })
      
      // Process failed metrics
      queueData.failedMetrics.dataPoints.forEach((point) => {
        const minutesAgo = Math.floor((now - point.timestamp) / (60 * 1000))
        const bucketIndex = Math.floor((totalMinutes - minutesAgo - 1) / bucketSizeMinutes)
        
        if (bucketIndex >= 0 && bucketIndex < numBuckets && minutesAgo < totalMinutes) {
          buckets[bucketIndex].failed += point.value
        }
      })
    })
    
    // Ensure buckets are ordered oldest to newest (left to right on chart)
    // The bucket creation and mapping should already be correct, but if there's
    // any confusion about data ordering, this ensures the display is always correct
    const history = buckets
    
    return {
      queueCount: queueNames.length,
      jobCounts,
      throughput,
      history,
    }
  }
)

/**
 * Pause a queue
 */
export const pauseQueue = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      queueName: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    const { queueName } = data
    const queue = getQueue(queueName)
    await queue.pause()
    return { success: true, queueName, isPaused: true }
  })

/**
 * Resume a queue
 */
export const resumeQueue = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      queueName: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    const { queueName } = data
    const queue = getQueue(queueName)
    await queue.resume()
    return { success: true, queueName, isPaused: false }
  })
