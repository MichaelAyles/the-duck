import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * 💳 Credits Management API
 * 
 * GET: Fetches user's credit information and current usage
 * PUT: Updates user's credit settings (limit, reset period)
 */

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Get or create user credits
    let { data: credits } = await supabase
      .from('user_credits')
      .select('*')
      .eq('user_id', user.id)
      .single()

    // If no credits record exists, create one with defaults
    if (!credits) {
      const { data: newCredits, error: insertError } = await supabase
        .from('user_credits')
        .insert({
          user_id: user.id,
          credit_limit: 10.00, // $10 default
          credits_used: 0.00,
          reset_period: 'monthly'
        })
        .select()
        .single()

      if (insertError) {
        console.error('Failed to create credits record:', insertError)
        return NextResponse.json({ error: 'Failed to initialize credits' }, { status: 500 })
      }

      credits = newCredits
    }

    // Check if credits need to be reset based on period
    if (credits) {
      const lastReset = new Date(credits.last_reset)
      const now = new Date()
      let shouldReset = false

      switch (credits.reset_period) {
        case 'daily':
          shouldReset = now.getTime() - lastReset.getTime() > 24 * 60 * 60 * 1000
          break
        case 'weekly':
          shouldReset = now.getTime() - lastReset.getTime() > 7 * 24 * 60 * 60 * 1000
          break
        case 'monthly':
          const lastResetMonth = lastReset.getMonth()
          const currentMonth = now.getMonth()
          shouldReset = currentMonth !== lastResetMonth || now.getFullYear() !== lastReset.getFullYear()
          break
      }

      if (shouldReset) {
        const { data: updatedCredits, error: updateError } = await supabase
          .from('user_credits')
          .update({
            credits_used: 0.00,
            last_reset: now.toISOString()
          })
          .eq('user_id', user.id)
          .select()
          .single()

        if (!updateError && updatedCredits) {
          credits = updatedCredits
        }
      }
    }

    // Get usage summary for current period
    const periodStart = credits?.last_reset || new Date().toISOString()
    
    const { data: usage, error: usageError } = await supabase
      .from('user_usage')
      .select('model, total_tokens, total_cost, created_at')
      .eq('user_id', user.id)
      .gte('created_at', periodStart)
      .order('created_at', { ascending: false })

    if (usageError) {
      console.error('Failed to fetch usage:', usageError)
    }

    // Calculate usage by model
    const usageByModel = usage?.reduce((acc, record) => {
      if (!acc[record.model]) {
        acc[record.model] = {
          tokens: 0,
          cost: 0,
          count: 0
        }
      }
      acc[record.model].tokens += record.total_tokens
      acc[record.model].cost += record.total_cost
      acc[record.model].count += 1
      return acc
    }, {} as Record<string, { tokens: number; cost: number; count: number }>)

    return NextResponse.json({
      credits,
      usage: usage || [],
      usageByModel: usageByModel || {},
      remainingCredits: credits ? Math.max(0, credits.credit_limit - credits.credits_used) : 0
    })
  } catch (error) {
    console.error('Credits API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch credits information' },
      { status: 500 }
    )
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await req.json()
    const { credit_limit, reset_period } = body

    // Validate input
    if (credit_limit !== undefined && (typeof credit_limit !== 'number' || credit_limit < 0)) {
      return NextResponse.json({ error: 'Invalid credit limit' }, { status: 400 })
    }

    if (reset_period !== undefined && !['daily', 'weekly', 'monthly', 'never'].includes(reset_period)) {
      return NextResponse.json({ error: 'Invalid reset period' }, { status: 400 })
    }

    // Update user credits
    const updateData: Record<string, number | string> = {}
    if (credit_limit !== undefined) updateData.credit_limit = credit_limit
    if (reset_period !== undefined) updateData.reset_period = reset_period

    const { data: credits, error: updateError } = await supabase
      .from('user_credits')
      .update(updateData)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      console.error('Failed to update credits:', updateError)
      return NextResponse.json({ error: 'Failed to update credits' }, { status: 500 })
    }

    return NextResponse.json({ credits })
  } catch (error) {
    console.error('Credits update error:', error)
    return NextResponse.json(
      { error: 'Failed to update credits' },
      { status: 500 }
    )
  }
}