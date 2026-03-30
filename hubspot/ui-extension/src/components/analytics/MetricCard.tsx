import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Metric } from "@/types/analytics"
import { formatNumber, formatPercentage, formatCurrency } from "@/lib/utils"
import { ArrowUp, ArrowDown, Minus } from "lucide-react"

interface MetricCardProps {
  metric: Metric
  providerColor?: string
}

export function MetricCard({ metric, providerColor = "blue" }: MetricCardProps) {
  const formatValue = (value: number | string, format: Metric['format']) => {
    if (typeof value === 'string') return value
    
    switch (format) {
      case 'percentage':
        return formatPercentage(value)
      case 'currency':
        return formatCurrency(value)
      case 'duration':
        return `${Math.floor(value / 60)}:${(value % 60).toString().padStart(2, '0')}`
      default:
        return formatNumber(value)
    }
  }

  const getTrendIcon = () => {
    if (!metric.trend) return null
    
    switch (metric.trend.direction) {
      case 'up':
        return <ArrowUp className="h-4 w-4 text-green-500" />
      case 'down':
        return <ArrowDown className="h-4 w-4 text-red-500" />
      case 'stable':
        return <Minus className="h-4 w-4 text-gray-500" />
    }
  }

  const getTrendColor = () => {
    if (!metric.trend) return ''
    
    switch (metric.trend.direction) {
      case 'up':
        return 'text-green-600'
      case 'down':
        return 'text-red-600'
      case 'stable':
        return 'text-gray-600'
    }
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {metric.label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-2xl font-bold">
              {formatValue(metric.value, metric.format)}
            </div>
            {metric.trend && (
              <div className={`flex items-center gap-1 text-xs ${getTrendColor()}`}>
                {getTrendIcon()}
                <span>
                  {formatPercentage(Math.abs(metric.trend.value))} vs {metric.trend.period}
                </span>
              </div>
            )}
          </div>
          <div 
            className="w-3 h-8 rounded-full opacity-20"
            style={{ backgroundColor: providerColor }}
          />
        </div>
      </CardContent>
    </Card>
  )
}