import { createFileRoute } from '@tanstack/react-router'
import { GlobalMetrics } from '../components/GlobalMetrics'
import { SystemHealthBanner } from '../components/SystemHealthBanner'
import { PredictiveInsights } from '../components/PredictiveInsights'
import { QueuesList } from '../components/QueuesList'

export const Route = createFileRoute('/')({  
  component: Dashboard,
})

function Dashboard() {
  return (
    <div className="container mx-auto px-4 py-8">

      {/* System Health Banner */}
      <SystemHealthBanner />

      {/* Predictive Insights - Intelligent alerts and recommendations */}
      <div className="mb-8">
        <PredictiveInsights />
      </div>

      {/* Global Metrics */}
      <GlobalMetrics />

      {/* Queues List */}
      <QueuesList />
    </div>
  )
}
