import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AnalyticsProvider, Metric } from "@/types/analytics"
import { MetricCard } from "./MetricCard"

interface ProviderCardProps {
  provider: AnalyticsProvider
  metrics: Metric[]
  lastUpdated: string
}

export function ProviderCard({ provider, metrics, lastUpdated }: ProviderCardProps) {
  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div 
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
            style={{ backgroundColor: provider.color }}
          >
            {provider.icon}
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg">{provider.name}</CardTitle>
            <p className="text-sm text-muted-foreground">
              最終更新: {new Date(lastUpdated).toLocaleString('ja-JP')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div 
              className={`w-2 h-2 rounded-full ${
                provider.enabled ? 'bg-green-500' : 'bg-gray-400'
              }`} 
            />
            <span className="text-xs text-muted-foreground">
              {provider.enabled ? 'アクティブ' : '無効'}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {metrics.map((metric) => (
            <MetricCard 
              key={metric.id} 
              metric={metric} 
              providerColor={provider.color}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}