'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartDataPoint } from "@/types/analytics"
import { formatNumber } from "@/lib/utils"

interface AnalyticsChartProps {
  title: string
  description?: string
  data: ChartDataPoint[]
  dataKey: string
  color?: string
  type?: 'line' | 'area' | 'bar'
}

export function AnalyticsChart({
  title,
  description,
  data,
  dataKey,
  color = "#3b82f6"
}: AnalyticsChartProps) {
  // 簡単な棒グラフ風の視覚化
  const maxValue = Math.max(...data.map(d => Number(d[dataKey] || 0)))
  const minValue = Math.min(...data.map(d => Number(d[dataKey] || 0)))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        {description && (
          <CardDescription>{description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          <div className="h-full flex items-end gap-1 p-4">
            {data.slice(-14).map((item, index) => {
              const value = Number(item[dataKey] || 0)
              const height = maxValue > 0 ? ((value - minValue) / (maxValue - minValue)) * 100 : 0
              
              return (
                <div key={index} className="flex-1 flex flex-col items-center gap-2">
                  <div className="text-xs text-muted-foreground">
                    {formatNumber(value)}
                  </div>
                  <div 
                    className="w-full rounded-t transition-all hover:opacity-80"
                    style={{ 
                      height: `${Math.max(height, 5)}%`,
                      backgroundColor: color,
                      opacity: 0.8
                    }}
                  />
                  <div className="text-xs text-muted-foreground">
                    {item.date.slice(-2)}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-2 text-center text-xs text-muted-foreground">
            最大値: {formatNumber(maxValue)} | 最小値: {formatNumber(minValue)}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}