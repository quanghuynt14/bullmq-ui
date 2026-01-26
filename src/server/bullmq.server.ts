import { Queue } from 'bullmq'
import Redis from 'ioredis'
import type { Job } from 'bullmq'

/**
 * Queue cache to reuse connections
 */
const queueCache = new Map<string, Queue>()

/**
 * Cached Redis client for scanning
 */
let scanClient: Redis | null = null

/**
 * Queue names cache with TTL for high-performance lookups
 */
let queueNamesCache: {
  names: Array<string>
  timestamp: number
} | null = null

const QUEUE_NAMES_CACHE_TTL = 5000 // 5 seconds - balance between freshness and performance
const SCAN_COUNT = 10000 // Higher count for 100M keys - processes more keys per iteration
const PREFIX = 'bull:'
const SUFFIX = ':meta'
const PREFIX_LEN = 5 // 'bull:'.length
const SUFFIX_LEN = 5 // ':meta'.length

/**
 * Get Redis connection config from environment
 */
export function getRedisConfig() {
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
  }
}

/**
 * Get or create a BullMQ Queue instance
 */
export function getQueue(queueName: string): Queue {

  console.log("Getting queue:", queueName);
  if (!queueCache.has(queueName)) {
    const queue = new Queue(queueName, {
      connection: getRedisConfig(),
    })
    queueCache.set(queueName, queue)
  }
  return queueCache.get(queueName)!
}

/**
 * Auto-discover all queue names from Redis by scanning for BullMQ queue keys
 * BullMQ stores queue data with keys like: "bull:{queueName}:*"
 * Optimized for 100M+ keys with caching and efficient string parsing
 */
export async function getQueueNames(): Promise<Array<string>> {
  const now = Date.now()
  
  // O(1) cache hit - return immediately if cache is fresh
  if (queueNamesCache && (now - queueNamesCache.timestamp) < QUEUE_NAMES_CACHE_TTL) {
    return queueNamesCache.names
  }
  
  // Create or reuse Redis client for scanning
  if (!scanClient) {
    scanClient = new Redis(getRedisConfig())
  }
  
  const queueNames = new Set<string>()

  // Scan for all BullMQ queue keys with optimized parameters
  // Higher COUNT (10000) = fewer round trips for 100M keys
  let cursor = '0'
  do {
    const result = await scanClient.scan(
      cursor,
      'MATCH',
      'bull:*:meta',
      'COUNT',
      SCAN_COUNT,
    )
    cursor = result[0]
    const keys = result[1]

    // Extract queue names - use string parsing instead of regex (3-5x faster)
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      // Quick validation: must start with 'bull:' and end with ':meta'
      if (key.startsWith(PREFIX) && key.endsWith(SUFFIX)) {
        // Extract queue name: everything between 'bull:' and ':meta'
        const queueName = key.slice(PREFIX_LEN, key.length - SUFFIX_LEN)
        // Validate it's actually a queue name (no additional colons)
        if (queueName && !queueName.includes(':')) {
          queueNames.add(queueName)
        }
      }
    }
  } while (cursor !== '0')

    console.log(`Discovered ${queueNames.size} queues from Redis.`);

  // Sort once at the end (more efficient than sorted insertion)
  const sortedNames = Array.from(queueNames).sort()
  
  // Update cache for subsequent O(1) lookups
  queueNamesCache = {
    names: sortedNames,
    timestamp: now,
  }

  return sortedNames
}

/**
 * Job status types - 6 actual BullMQ states + filter views
 * Actual states: wait, waiting-children, active, completed, failed, delayed
 * Filter views: latest (all states), prioritized (wait with priority)
 * Note: Prioritized jobs are counted as 'wait' jobs
 */
export type JobStatus =
  | 'latest' // Filter: all states
  | 'wait'
  | 'waiting-children'
  | 'active'
  | 'completed'
  | 'failed'
  | 'delayed'
  | 'prioritized' // Filter: wait jobs with priority (counted in wait)

/**
 * Get jobs by status with pagination
 */
export async function getJobsByStatus(
  queueName: string,
  status: JobStatus,
  start: number = 0,
  end: number = 24,
): Promise<Array<Job>> {
  const queue = getQueue(queueName)

  if (status === 'latest') {
    // For 'latest', we need to fetch more jobs to ensure proper pagination after sorting
    // Fetch enough to cover the requested page (we need to fetch past 'end' from each queue)
    const fetchEnd = Math.max(end * 2, 100) // Fetch 2x or at least 100 to ensure we have enough
    const results = await Promise.allSettled([
      queue.getActive(0, fetchEnd),
      queue.getWaiting(0, fetchEnd),
      queue.getCompleted(0, fetchEnd),
      queue.getFailed(0, fetchEnd),
      queue.getDelayed(0, fetchEnd),
      queue.getPrioritized(0, fetchEnd),
      queue.getWaitingChildren(0, fetchEnd),
    ])
    
    const allJobs = results.flatMap(r => r.status === 'fulfilled' ? r.value : [])
    
    // Sort by timestamp (most recent first) and apply pagination
    return allJobs
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      .slice(start, end + 1)
  }

  // Map status to BullMQ methods
  switch (status) {
    case 'wait':
      return queue.getWaiting(start, end)
    case 'waiting-children':
      return queue.getWaitingChildren(start, end) 
    case 'active':
      return queue.getActive(start, end)
    case 'completed':
      return queue.getCompleted(start, end)
    case 'failed':
      return queue.getFailed(start, end)
    case 'delayed':
      return queue.getDelayed(start, end)
    case 'prioritized':
      // Filter view: get wait jobs with priority (subset of wait)
      return queue.getPrioritized(start, end)
    default:
      return []
  }
}

/**
 * Get metrics data for completed/failed jobs
 * @param queueName - Name of the queue
 * @param type - Type of metric ('completed' or 'failed')
 * @param timeRange - Time range in minutes (e.g., 60 for last hour)
 */
export async function getQueueMetrics(
  queueName: string,
  type: 'completed' | 'failed',
  timeRange: number = 60
) {
  const queue = getQueue(queueName)
  
  try {
    // BullMQ's getMetrics returns time-series data
    // start=0, end=timeRange gets the last `timeRange` data points
    // Each data point represents 1 MINUTE of job counts
    // Index 0 = most recent minute, Index N = N minutes ago
    const metrics = await queue.getMetrics(type, 0, timeRange)
    
    // Calculate total from the data points we have (sum of jobs in the time range)
    const total = metrics.data.reduce((sum, val) => sum + val, 0)
    
    // BullMQ getMetrics returns data where:
    // - Index 0 = most recent minute (now)
    // - Last index = oldest minute (N minutes ago)
    // We keep this order and handle the mapping in getGlobalMetrics
    const now = Date.now()
    const dataPoints = metrics.data.map((value, index) => {
      // index 0 = 0 min ago (now), index 1 = 1 min ago, etc.
      return {
        timestamp: now - (index * 60000),
        value,
      }
    })
    
    // Rate = jobs per minute over the time range
    const actualMinutes = metrics.data.length || 1
    const rate = total / actualMinutes
    
    return {
      total,
      rate: parseFloat(rate.toFixed(2)),
      dataPoints, // Now ordered: oldest first, newest last
      meta: {
        count: metrics.meta.count || 0,
        prevCount: metrics.meta.prevCount || 0,
      },
    }
  } catch (error) {
    console.error(`Error getting metrics for ${queueName}:`, error)
    return {
      total: 0,
      rate: 0,
      dataPoints: [],
      meta: { count: 0, prevCount: 0 },
    }
  }
}

/**
 * Close all queue connections (cleanup)
 */
export async function closeAllQueues() {
  const closePromises = Array.from(queueCache.values()).map((queue) =>
    queue.close(),
  )
  await Promise.all(closePromises)
  queueCache.clear()
  
  // Clear queue names cache
  queueNamesCache = null
  
  // Close scan client if it exists
  if (scanClient) {
    await scanClient.quit()
    scanClient = null
  }
}
