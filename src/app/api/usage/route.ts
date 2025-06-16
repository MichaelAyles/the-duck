import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * 📊 Usage Statistics API
 * 
 * GET: Fetches detailed usage statistics with filtering options
 */

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const period = searchParams.get('period') || '7d' // 7d, 30d, all
    const groupBy = searchParams.get('groupBy') || 'day' // day, model

    // Calculate date range
    let startDate: Date
    const now = new Date()
    
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case 'all':
        startDate = new Date(0) // Beginning of time
        break
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    }

    // Get usage data
    const { data: usage, error: usageError } = await supabase
      .from('user_usage')
      .select('*')
      .eq('user_id', user.id)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false })

    if (usageError) {
      console.error('Failed to fetch usage:', usageError)
      return NextResponse.json({ error: 'Failed to fetch usage data' }, { status: 500 })
    }

    // Calculate aggregated statistics
    const stats = {
      totalCost: usage.reduce((sum, record) => sum + record.total_cost, 0),
      totalTokens: usage.reduce((sum, record) => sum + record.total_tokens, 0),
      totalRequests: usage.length,
      averageCostPerRequest: usage.length > 0 ? usage.reduce((sum, record) => sum + record.total_cost, 0) / usage.length : 0,
      averageTokensPerRequest: usage.length > 0 ? usage.reduce((sum, record) => sum + record.total_tokens, 0) / usage.length : 0
    }

    // Group data based on groupBy parameter
    let groupedData: Record<string, Record<string, number>> = {}
    
    if (groupBy === 'day') {
      // Group by day
      groupedData = usage.reduce((acc, record) => {
        const date = new Date(record.created_at).toISOString().split('T')[0]
        if (!acc[date]) {
          acc[date] = {
            cost: 0,
            tokens: 0,
            requests: 0
          }
        }
        acc[date].cost += record.total_cost
        acc[date].tokens += record.total_tokens
        acc[date].requests += 1
        return acc
      }, {} as Record<string, { cost: number; tokens: number; requests: number }>)
    } else if (groupBy === 'model') {
      // Group by model
      groupedData = usage.reduce((acc, record) => {
        if (!acc[record.model]) {
          acc[record.model] = {
            cost: 0,
            tokens: 0,
            requests: 0,
            avgCostPerRequest: 0,
            avgTokensPerRequest: 0
          }
        }
        acc[record.model].cost += record.total_cost
        acc[record.model].tokens += record.total_tokens
        acc[record.model].requests += 1
        return acc
      }, {} as Record<string, Record<string, number>>)

      // Calculate averages for each model
      Object.keys(groupedData).forEach(model => {
        const data = groupedData[model] as Record<string, number>
        data.avgCostPerRequest = data.cost / data.requests
        data.avgTokensPerRequest = data.tokens / data.requests
      })
    }

    // Get most used models
    const modelUsage = usage.reduce((acc, record) => {
      acc[record.model] = (acc[record.model] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const topModels = Object.entries(modelUsage)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 5)
      .map(([model, count]) => ({ model, count }))

    return NextResponse.json({
      stats,
      groupedData,
      topModels,
      rawData: usage,
      period,
      startDate: startDate.toISOString()
    })
  } catch (error) {
    console.error('Usage API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch usage statistics' },
      { status: 500 }
    )
  }
}