import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export interface LearningPreference {
  id: string
  category: string
  preference_key: string
  preference_value?: string
  weight: number
  source: 'manual' | 'chat_summary' | 'implicit' | 'feedback'
  confidence: number
  last_reinforced_at: string
  created_at: string
  updated_at: string
}

export interface LearningPreferencesResponse {
  preferences: LearningPreference[]
  summary: {
    total_preferences: number
    strong_likes: number
    strong_dislikes: number
    categories: string[]
    recent_changes: number
  }
}

// GET - Retrieve user's learning preferences
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0

    // Build query
    let query = supabase
      .from('user_learning_preferences')
      .select('*')
      .eq('user_id', user.id)
      .order('weight', { ascending: false })
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (category) {
      query = query.eq('category', category)
    }

    const { data: preferences, error: prefError } = await query

    if (prefError) {
      console.error('Failed to fetch learning preferences:', prefError)
      
      // If table doesn't exist yet, return empty state
      if (prefError.message?.includes('relation') || prefError.message?.includes('does not exist')) {
        console.warn('Learning preferences table not yet deployed, returning empty state')
        return NextResponse.json({
          preferences: [],
          summary: {
            total_preferences: 0,
            strong_likes: 0,
            strong_dislikes: 0,
            categories: [],
            recent_changes: 0
          }
        })
      }
      
      return NextResponse.json(
        { error: 'Failed to fetch learning preferences' },
        { status: 500 }
      )
    }

    // Get summary statistics
    const { data: summaryData, error: summaryError } = await supabase
      .rpc('get_user_learning_summary', { target_user_id: user.id })

    if (summaryError) {
      console.error('Failed to fetch learning summary:', summaryError)
      
      // If function doesn't exist yet, use default summary
      if (summaryError.message?.includes('function') || summaryError.message?.includes('does not exist')) {
        console.warn('Learning summary function not yet deployed, using default summary')
      } else {
        return NextResponse.json(
          { error: 'Failed to fetch learning summary' },
          { status: 500 }
        )
      }
    }

    const summary = summaryData?.[0] || {
      total_preferences: 0,
      strong_likes: 0,
      strong_dislikes: 0,
      categories: [],
      recent_changes: 0
    }

    return NextResponse.json({
      preferences: preferences || [],
      summary
    })
  } catch (error) {
    console.error('Error in GET /api/learning-preferences:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Add or update a learning preference
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      category, 
      preference_key, 
      preference_value, 
      weight, 
      source = 'manual'
    } = body

    // Validate required fields
    if (!category || !preference_key) {
      return NextResponse.json(
        { error: 'Missing required fields: category, preference_key' },
        { status: 400 }
      )
    }

    // Validate weight range
    if (weight === undefined || weight < -10 || weight > 10) {
      return NextResponse.json(
        { error: 'Weight must be between -10 and 10' },
        { status: 400 }
      )
    }

    // Validate source
    if (!['manual', 'chat_summary', 'implicit', 'feedback'].includes(source)) {
      return NextResponse.json(
        { error: 'Invalid source value' },
        { status: 400 }
      )
    }

    // Use the upsert function
    const { data: preferenceId, error: upsertError } = await supabase
      .rpc('upsert_learning_preference', {
        target_user_id: user.id,
        pref_category: category,
        pref_key: preference_key,
        pref_value: preference_value || null,
        pref_weight: weight,
        pref_source: source
      })

    if (upsertError) {
      console.error('Failed to upsert learning preference:', upsertError)
      
      // Check if it's a limit violation
      if (upsertError.message?.includes('1000 learning preferences')) {
        return NextResponse.json(
          { error: 'Maximum learning preferences limit reached (1000)' },
          { status: 400 }
        )
      }
      
      // Check if it's a missing table/function error
      if (upsertError.message?.includes('relation') || upsertError.message?.includes('does not exist') || upsertError.message?.includes('function')) {
        return NextResponse.json(
          { 
            error: 'Learning preferences system not yet deployed',
            details: 'The database schema needs to be deployed. Please run the learning preferences migration.',
            code: 'SCHEMA_NOT_DEPLOYED'
          },
          { status: 503 }
        )
      }
      
      return NextResponse.json(
        { 
          error: 'Failed to save learning preference',
          details: upsertError.message
        },
        { status: 500 }
      )
    }

    // Fetch the updated preference
    const { data: updatedPreference, error: fetchError } = await supabase
      .from('user_learning_preferences')
      .select('*')
      .eq('id', preferenceId)
      .single()

    if (fetchError) {
      console.error('Failed to fetch updated preference:', fetchError)
      return NextResponse.json(
        { error: 'Preference saved but failed to retrieve' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      preference: updatedPreference,
      message: 'Learning preference updated successfully'
    })
  } catch (error) {
    console.error('Error in POST /api/learning-preferences:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Bulk update multiple learning preferences
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { preferences } = body

    if (!Array.isArray(preferences)) {
      return NextResponse.json(
        { error: 'Preferences must be an array' },
        { status: 400 }
      )
    }

    const results = []
    const errors = []

    // Process each preference
    for (const pref of preferences) {
      try {
        const { data: preferenceId, error: upsertError } = await supabase
          .rpc('upsert_learning_preference', {
            target_user_id: user.id,
            pref_category: pref.category,
            pref_key: pref.preference_key,
            pref_value: pref.preference_value || null,
            pref_weight: pref.weight,
            pref_source: pref.source || 'manual'
          })

        if (upsertError) {
          errors.push({
            preference: pref,
            error: upsertError.message
          })
        } else {
          results.push(preferenceId)
        }
      } catch (error) {
        errors.push({
          preference: pref,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      success: results.length,
      errors: errors.length,
      details: errors.length > 0 ? errors : undefined,
      message: `Updated ${results.length} preferences${errors.length > 0 ? ` with ${errors.length} errors` : ''}`
    })
  } catch (error) {
    console.error('Error in PUT /api/learning-preferences:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Remove learning preferences
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const category = searchParams.get('category')
    const preference_key = searchParams.get('preference_key')

    // Delete by ID
    if (id) {
      const { error: deleteError } = await supabase
        .from('user_learning_preferences')
        .delete()
        .eq('user_id', user.id)
        .eq('id', id)

      if (deleteError) {
        console.error('Failed to delete learning preference:', deleteError)
        return NextResponse.json(
          { error: 'Failed to delete learning preference' },
          { status: 500 }
        )
      }

      return NextResponse.json({ 
        message: 'Learning preference deleted successfully' 
      })
    }

    // Delete by category and key
    if (category && preference_key) {
      const { error: deleteError } = await supabase
        .from('user_learning_preferences')
        .delete()
        .eq('user_id', user.id)
        .eq('category', category)
        .eq('preference_key', preference_key)

      if (deleteError) {
        console.error('Failed to delete learning preference:', deleteError)
        return NextResponse.json(
          { error: 'Failed to delete learning preference' },
          { status: 500 }
        )
      }

      return NextResponse.json({ 
        message: 'Learning preference deleted successfully' 
      })
    }

    // Delete all preferences (reset knowledge)
    const { error: deleteError } = await supabase
      .from('user_learning_preferences')
      .delete()
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Failed to delete all learning preferences:', deleteError)
      
      // If table doesn't exist yet, return success
      if (deleteError.message?.includes('relation') || deleteError.message?.includes('does not exist')) {
        return NextResponse.json({ 
          message: 'No preferences to delete' 
        })
      }
      
      return NextResponse.json(
        { error: 'Failed to delete learning preferences' },
        { status: 500 }
      )
    }

    // Also delete all chat summaries
    const { error: summaryError } = await supabase
      .from('chat_summaries')
      .delete()
      .eq('user_id', user.id)

    if (summaryError) {
      console.error('Failed to delete chat summaries:', summaryError)
      // Don't fail the request if summaries can't be deleted
    }

    return NextResponse.json({ 
      message: 'All learning preferences and summaries deleted successfully' 
    })
  } catch (error) {
    console.error('Error in DELETE /api/learning-preferences:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}