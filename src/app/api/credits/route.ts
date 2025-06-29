import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger';

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

    // If no credits record exists, create one with defaults using upsert to prevent race conditions
    if (!credits) {
      const { data: newCredits, error: upsertError } = await supabase
        .from('user_credits')
        .upsert({
          user_id: user.id,
          total_credits: 100, // £1.00 limit (100 pence)
          used_credits: 0,
          credit_limit_period: 'monthly'
        }, {
          onConflict: 'user_id',
          ignoreDuplicates: false
        })
        .select()
        .single()

      if (upsertError) {
        // Handle unique constraint violation gracefully
        if (upsertError.code === '23505') {
          // Duplicate key error, try to fetch again
          const { data: existingCredits } = await supabase
            .from('user_credits')
            .select('*')
            .eq('user_id', user.id)
            .single()
          
          credits = existingCredits
        } else {
          logger.error('Failed to create credits record:', upsertError)
          return NextResponse.json({ error: 'Failed to initialize credits' }, { status: 500 })
        }
      } else {
        credits = newCredits
      }
    }

    // Check if credits need to be reset based on period
    if (credits) {
      const lastReset = new Date(credits.last_reset_at)
      const now = new Date()
      let shouldReset = false

      switch (credits.credit_limit_period) {
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
            used_credits: 0,
            last_reset_at: now.toISOString()
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
    const periodStart = credits?.last_reset_at || new Date().toISOString()
    
    const { data: usage, error: usageError } = await supabase
      .from('user_usage')
      .select('model, token_count, timestamp, metadata')
      .eq('user_id', user.id)
      .gte('timestamp', periodStart)
      .order('timestamp', { ascending: false })

    if (usageError) {
      logger.error('Failed to fetch usage:', usageError)
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
      acc[record.model].tokens += record.token_count || 0
      // Extract cost from metadata if available
      const metadata = record.metadata as { total_cost?: number; totalCost?: number }
      const totalCost = metadata?.total_cost || metadata?.totalCost || 0
      acc[record.model].cost += totalCost
      acc[record.model].count += 1
      return acc
    }, {} as Record<string, { tokens: number; cost: number; count: number }>)

    return NextResponse.json({
      credits,
      usage: usage || [],
      usageByModel: usageByModel || {},
      remainingCredits: credits ? Math.max(0, credits.total_credits - credits.used_credits) : 0
    })
  } catch (error) {
    logger.error('Credits API error:', error)
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
    const { total_credits, credit_limit_period } = body

    // Validate input
    if (total_credits !== undefined && (typeof total_credits !== 'number' || total_credits < 0)) {
      return NextResponse.json({ error: 'Invalid credit limit' }, { status: 400 })
    }

    if (credit_limit_period !== undefined && !['daily', 'weekly', 'monthly'].includes(credit_limit_period)) {
      return NextResponse.json({ error: 'Invalid reset period' }, { status: 400 })
    }

    // Update user credits
    const updateData: Record<string, number | string> = {}
    if (total_credits !== undefined) updateData.total_credits = total_credits
    if (credit_limit_period !== undefined) updateData.credit_limit_period = credit_limit_period

    const { data: credits, error: updateError } = await supabase
      .from('user_credits')
      .update(updateData)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      logger.error('Failed to update credits:', updateError)
      return NextResponse.json({ error: 'Failed to update credits' }, { status: 500 })
    }

    return NextResponse.json({ credits })
  } catch (error) {
    logger.error('Credits update error:', error)
    return NextResponse.json(
      { error: 'Failed to update credits' },
      { status: 500 }
    )
  }
}