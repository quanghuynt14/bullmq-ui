import { createServerFn } from '@tanstack/react-start'
import { analyzeSystemHealth } from './health-monitor.functions'
import { getQueuesStatsWithMetrics } from './queues.functions'
import type { SystemHealth } from './health-monitor.functions'

/**
 * Server function to get comprehensive system health analysis
 * Includes predictions and actionable recommendations
 */
export const getSystemHealth = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SystemHealth> => {
    try {
      // Get current queue statistics
      const queuesStats = await getQueuesStatsWithMetrics()
      
      // Analyze health and generate insights
      const health = analyzeSystemHealth(queuesStats)
      
      return health
    } catch (error) {
      console.error('Error getting system health:', error)
      
      // Return safe default
      return {
        status: 'warning',
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
  }
)
