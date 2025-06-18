"use client"

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { RefreshCw, DollarSign, Activity, TrendingUp, Settings } from 'lucide-react'

interface CreditInfo {
  user_id: string
  total_credits: number
  used_credits: number
  credit_limit_period: 'daily' | 'weekly' | 'monthly'
  last_reset_at: string
  created_at: string
  updated_at: string
}

interface UsageRecord {
  model: string
  total_tokens: number
  total_cost: number
  created_at: string
}

interface UsageData {
  credits: CreditInfo
  usage: UsageRecord[]
  usageByModel: Record<string, { tokens: number; cost: number; count: number }>
  remainingCredits: number
}

export function UsageSummary() {
  const [usageData, setUsageData] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const { toast } = useToast()

  const fetchUsageData = useCallback(async () => {
    try {
      const response = await fetch('/api/credits')
      if (!response.ok) {
        throw new Error('Failed to fetch usage data')
      }
      const data = await response.json()
      setUsageData(data)
    } catch (error) {
      console.error('Error fetching usage data:', error)
      toast({
        title: "Error",
        description: "Failed to load usage data. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  const updateCreditSettings = async (updates: { total_credits?: number; credit_limit_period?: string }) => {
    setUpdating(true)
    try {
      const response = await fetch('/api/credits', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        throw new Error('Failed to update credit settings')
      }

      await fetchUsageData() // Refresh data
      toast({
        title: "Success",
        description: "Credit settings updated successfully.",
      })
    } catch (error) {
      console.error('Error updating credit settings:', error)
      toast({
        title: "Error",
        description: "Failed to update credit settings. Please try again.",
        variant: "destructive",
      })
    } finally {
      setUpdating(false)
    }
  }

  useEffect(() => {
    fetchUsageData()
  }, [fetchUsageData])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Usage & Credits
          </CardTitle>
          <CardDescription>Loading usage information...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!usageData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Usage & Credits
          </CardTitle>
          <CardDescription>Failed to load usage data</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={fetchUsageData} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  const { credits, usageByModel, remainingCredits } = usageData
  const usagePercent = (credits.used_credits / credits.total_credits) * 100
  const isLowCredit = remainingCredits < credits.total_credits * 0.1

  const topModels = Object.entries(usageByModel)
    .sort(([, a], [, b]) => b.cost - a.cost)
    .slice(0, 3)

  const resetPeriodOptions = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
  ]

  return (
    <div className="space-y-6">
      {/* Credit Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Credit Overview
          </CardTitle>
          <CardDescription>
            Your current usage for this {credits.credit_limit_period} period
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">Used</div>
              <div className="text-2xl font-bold text-primary">
                ${credits.used_credits.toFixed(2)}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Remaining</div>
              <div className={`text-2xl font-bold ${isLowCredit ? 'text-destructive' : 'text-green-600'}`}>
                ${remainingCredits.toFixed(2)}
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Usage</span>
              <span>{usagePercent.toFixed(1)}% of ${credits.total_credits.toFixed(2)} limit</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all ${
                  usagePercent > 90 ? 'bg-destructive' : 
                  usagePercent > 70 ? 'bg-yellow-500' : 'bg-primary'
                }`}
                style={{ width: `${Math.min(usagePercent, 100)}%` }}
              />
            </div>
          </div>

          {isLowCredit && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <div className="text-sm text-destructive font-medium">
                ⚠️ Low Credit Warning
              </div>
              <div className="text-sm text-destructive/80">
                You&apos;re running low on credits. Consider increasing your limit.
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Credit Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Credit Settings
          </CardTitle>
          <CardDescription>
            Manage your spending limits and reset periods
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <label className="text-sm font-medium">
              Credit Limit: ${credits.total_credits.toFixed(2)}
            </label>
            <Slider
              value={[credits.total_credits]}
              onValueChange={([value]) => updateCreditSettings({ total_credits: value })}
              max={100}
              min={1}
              step={1}
              disabled={updating}
              className="py-4"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>$1</span>
              <span>$100</span>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium">Reset Period</label>
            <Select
              value={credits.credit_limit_period}
              onValueChange={(value) => updateCreditSettings({ credit_limit_period: value })}
              disabled={updating}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {resetPeriodOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground">
              Last reset: {new Date(credits.last_reset_at).toLocaleDateString()}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Usage by Model */}
      {topModels.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Usage by Model
            </CardTitle>
            <CardDescription>
              Your most used models this period
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topModels.map(([model, data]) => (
                <div key={model} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="space-y-1">
                    <div className="font-medium text-sm">{model}</div>
                    <div className="text-xs text-muted-foreground">
                      {data.count} requests • {data.tokens.toLocaleString()} tokens
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">${data.cost.toFixed(3)}</div>
                    <div className="text-xs text-muted-foreground">
                      ${(data.cost / data.count).toFixed(4)}/req
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={fetchUsageData}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh Data
        </Button>
      </div>
    </div>
  )
}