import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

// New optimized types for JSON-based preferences
export interface LearningPreferenceItem {
  value?: string
  weight: number
  source: 'manual' | 'chat_summary' | 'implicit' | 'feedback'
  confidence: number
  last_reinforced_at: string
  created_at: string
  updated_at: string
}

export interface LearningPreferencesData {
  [fullKey: string]: LearningPreferenceItem
}

// Legacy interface for backward compatibility with existing components
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
  preferences: LearningPreference[]  // Return legacy array format for compatibility
  summary: {
    total_preferences: number
    strong_likes: number
    strong_dislikes: number
    categories: string[]
    recent_changes: number
  }
}

// GET - Retrieve user's learning preferences (now single query!)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      logger.dev.log('🔒 Learning preferences GET: No authenticated user')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    logger.dev.log('📚 Learning preferences GET: User:', user.id, 'Category filter:', category)

    // Check if table exists first
    const { error: tableError } = await supabase
      .from('user_learning_preferences_v2')
      .select('*')
      .limit(0)

    logger.dev.log('🗃️ Learning preferences table check:', { 
      exists: !tableError, 
      error: tableError?.message || 'none' 
    })

    // Single query to get all user preferences as JSON
    const { data: userPrefs, error: prefError } = await supabase
      .from('user_learning_preferences_v2')
      .select('preferences')
      .eq('user_id', user.id)
      .single()

    logger.dev.log('🔍 Learning preferences query result:', { 
      found: !!userPrefs, 
      preferencesData: userPrefs?.preferences,
      error: prefError?.code || 'none' 
    })

    if (prefError) {
      // If no preferences found, return empty state
      if (prefError.code === 'PGRST116') {
        logger.dev.log('📭 No learning preferences found for user, returning empty state')
        return NextResponse.json({
          preferences: [], // Return empty array instead of empty object
          summary: {
            total_preferences: 0,
            strong_likes: 0,
            strong_dislikes: 0,
            categories: [],
            recent_changes: 0
          }
        })
      }
      
      logger.error('Failed to fetch learning preferences:', prefError)
      
      // If table doesn't exist yet, return empty state
      if (prefError.message?.includes('relation') || prefError.message?.includes('does not exist')) {
        logger.dev.log('⚠️ Learning preferences table not yet deployed, returning empty state')
        return NextResponse.json({
          preferences: [], // Return empty array instead of empty object
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

    let preferencesJSON = userPrefs?.preferences || {}
    logger.dev.log('🔄 Raw preferences JSON from database:', preferencesJSON)

    // Filter by category if requested
    if (category && preferencesJSON[category]) {
      preferencesJSON = { [category]: preferencesJSON[category] }
      logger.dev.log('🎯 Filtered by category:', category, preferencesJSON)
    } else if (category) {
      preferencesJSON = {}
      logger.dev.log('🎯 Category filter applied but no data for:', category)
    }

    // Convert JSON to legacy array format for backward compatibility
    const preferences = convertJSONToLegacyFormat(preferencesJSON)
    logger.dev.log('📋 Converted to legacy format:', preferences.length, 'preferences')

    // Get summary statistics with single function call - with validation
    logger.dev.log('📊 Attempting to get learning summary via RPC function...')
    let summaryData
    let summaryError: { message?: string; code?: string } | null = null
    
    try {
      const result = await supabase.rpc('get_user_learning_summary_v2', { target_user_id: user.id })
      summaryData = result.data
      summaryError = result.error
      logger.dev.log('📊 RPC function result:', { summaryData, error: summaryError?.code || 'none' })
    } catch (rpcError) {
      summaryError = rpcError as { message?: string; code?: string }
      logger.dev.log('📊 RPC function failed:', summaryError)
    }

    if (summaryError) {
      logger.error('Failed to fetch learning summary:', summaryError)
      
      // Handle missing function or table gracefully
      if (summaryError.message?.includes('function') || 
          summaryError.message?.includes('does not exist') ||
          summaryError.code === '42883' || // Function does not exist
          summaryError.code === '42P01') {  // Table does not exist
        logger.dev.log('⚠️ Learning summary function not yet deployed, calculating from JSON')
        const summary = calculateSummaryFromJSON(userPrefs?.preferences || {})
        logger.dev.log('📊 Calculated summary from JSON:', summary)
        return NextResponse.json({
          preferences,
          summary
        })
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

    logger.dev.log('📤 Returning learning preferences:', { 
      preferencesCount: preferences.length, 
      summary 
    })

    return NextResponse.json({
      preferences,
      summary
    })
  } catch (error) {
    logger.error('Error in GET /api/learning-preferences:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Add or update a learning preference (now single operation!)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      logger.dev.log('🔒 Learning preferences POST: No authenticated user')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      category, 
      preference_key, 
      preference_value, 
      weight, 
      source = 'manual',
      confidence = 1.0
    } = body

    logger.dev.log('💾 Learning preferences POST: Adding preference for user:', user.id)
    logger.dev.log('📋 Preference data:', { category, preference_key, preference_value, weight, source, confidence })

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

    // Use the optimized upsert function with validation
    logger.dev.log('🔧 Calling upsert_learning_preference_v2 RPC function...')
    let preferenceKey
    let upsertError: { message?: string; code?: string } | null = null
    
    const rpcParams = {
      target_user_id: user.id,
      pref_category: category,
      pref_key: preference_key,
      pref_value: preference_value || null,
      pref_weight: weight,
      pref_source: source,
      pref_confidence: confidence
    }
    logger.dev.log('🔧 RPC parameters:', rpcParams)
    
    try {
      const result = await supabase.rpc('upsert_learning_preference_v2', rpcParams)
      preferenceKey = result.data
      upsertError = result.error
      logger.dev.log('✅ RPC function result:', { preferenceKey, error: upsertError?.code || 'none' })
    } catch (rpcError) {
      upsertError = rpcError as { message?: string; code?: string }
      logger.dev.log('❌ RPC function failed:', upsertError)
    }

    if (upsertError) {
      logger.error('Failed to upsert learning preference:', upsertError)
      
      // Check if it's a missing table/function error with proper error codes
      if (upsertError.message?.includes('relation') || 
          upsertError.message?.includes('does not exist') || 
          upsertError.message?.includes('function') ||
          upsertError.code === '42883' || // Function does not exist
          upsertError.code === '42P01') {  // Table does not exist
        logger.error('🚨 Learning preferences schema not deployed!')
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
          details: upsertError.message || 'Unknown error'
        },
        { status: 500 }
      )
    }

    logger.dev.log('🎉 Learning preference successfully saved:', preferenceKey)
    return NextResponse.json({ 
      preference_key: preferenceKey,
      message: 'Learning preference updated successfully'
    })
  } catch (error) {
    logger.error('Error in POST /api/learning-preferences:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Bulk update multiple learning preferences (now atomic!)
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

    const results: string[] = []
    const errors: Array<{ preference: unknown; error: string }> = []

    // Process each preference with optimized upsert
    for (const pref of preferences) {
      try {
        const { data: preferenceKey, error: upsertError } = await supabase
          .rpc('upsert_learning_preference_v2', {
            target_user_id: user.id,
            pref_category: pref.category,
            pref_key: pref.preference_key,
            pref_value: pref.preference_value || null,
            pref_weight: pref.weight,
            pref_source: pref.source || 'manual',
            pref_confidence: pref.confidence || 1.0
          })

        if (upsertError) {
          errors.push({
            preference: pref,
            error: (upsertError as { message?: string })?.message || 'Unknown error'
          })
        } else {
          results.push(preferenceKey)
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
    logger.error('Error in PUT /api/learning-preferences:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Remove learning preferences (now supports JSON operations)
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const preference_key = searchParams.get('preference_key')

    // Delete specific preference
    if (category && preference_key) {
      const { data: deleted, error: deleteError } = await supabase
        .rpc('delete_learning_preference_v2', {
          target_user_id: user.id,
          pref_category: category,
          pref_key: preference_key
        })

      if (deleteError) {
        logger.error('Failed to delete learning preference:', deleteError)
        return NextResponse.json(
          { error: 'Failed to delete learning preference' },
          { status: 500 }
        )
      }

      if (!deleted) {
        return NextResponse.json(
          { error: 'Preference not found' },
          { status: 404 }
        )
      }

      return NextResponse.json({ 
        message: 'Learning preference deleted successfully' 
      })
    }

    // Delete all preferences (reset knowledge)
    const { error: deleteError } = await supabase
      .rpc('clear_learning_preferences_v2', {
        target_user_id: user.id
      })

    if (deleteError) {
      logger.error('Failed to delete all learning preferences:', deleteError)
      
      // If function doesn't exist yet, return success
      if ((deleteError as { message?: string })?.message?.includes('function') || (deleteError as { message?: string })?.message?.includes('does not exist')) {
        return NextResponse.json({ 
          message: 'No preferences to delete' 
        })
      }
      
      return NextResponse.json(
        { error: 'Failed to delete learning preferences' },
        { status: 500 }
      )
    }

    // Also delete all chat summaries for user's sessions
    // Since chat_summaries doesn't have user_id, we need to delete by session_id
    // where the session belongs to the user
    const { data: userSessions } = await supabase
      .from('chat_sessions')
      .select('id')
      .eq('user_id', user.id)
    
    if (userSessions && userSessions.length > 0) {
      const sessionIds = userSessions.map(session => session.id)
      const { error: summaryError } = await supabase
        .from('chat_summaries')
        .delete()
        .in('session_id', sessionIds)
      
      if (summaryError) {
        logger.error('Failed to delete chat summaries:', summaryError)
        // Don't fail the request if summaries can't be deleted
      }
    }

    return NextResponse.json({ 
      message: 'All learning preferences and summaries deleted successfully' 
    })
  } catch (error) {
    logger.error('Error in DELETE /api/learning-preferences:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Convert JSON structure to legacy array format for backward compatibility
function convertJSONToLegacyFormat(preferencesData: LearningPreferencesData): LearningPreference[] {
  const legacyPreferences: LearningPreference[] = []
  
  // Handle nested structure: { "topic": { "capybaras": {...}, "animals": {...} } }
  for (const [category, categoryPrefs] of Object.entries(preferencesData)) {
    if (!categoryPrefs || typeof categoryPrefs !== 'object') {
      continue
    }
    
    // Iterate through preferences within each category
    for (const [preferenceKey, pref] of Object.entries(categoryPrefs)) {
      // Handle the case where pref might be null or missing properties
      if (!pref || typeof pref !== 'object') {
        continue
      }
      
      legacyPreferences.push({
        id: `${category}.${preferenceKey}`, // Generate ID from category and key
        category,
        preference_key: preferenceKey,
        preference_value: pref.value || '',
        weight: pref.weight || 0,
        source: (pref.source as 'manual' | 'chat_summary' | 'implicit' | 'feedback') || 'manual',
        confidence: pref.confidence || 0.5,
        last_reinforced_at: pref.last_reinforced_at || new Date().toISOString(),
        created_at: pref.created_at || new Date().toISOString(),
        updated_at: pref.updated_at || new Date().toISOString()
      })
    }
  }
  
  // Sort by weight (descending) then by updated_at (descending) to match legacy behavior
  return legacyPreferences
    .sort((a, b) => {
      if (b.weight !== a.weight) {
        return b.weight - a.weight
      }
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    })
    .slice(0, 50) // Maintain the 50 item limit to avoid token bloat
}

// Helper function to calculate summary from JSON when DB function is not available
function calculateSummaryFromJSON(preferences: LearningPreferencesData) {
  let total_preferences = 0
  let strong_likes = 0
  let strong_dislikes = 0
  const categories: string[] = []
  let recent_changes = 0
  
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  
  // Handle nested structure: { "topic": { "capybaras": {...}, "animals": {...} } }
  for (const [category, categoryPrefs] of Object.entries(preferences)) {
    if (!categories.includes(category)) {
      categories.push(category)
    }
    
    if (!categoryPrefs || typeof categoryPrefs !== 'object') {
      continue
    }
    
    for (const [, pref] of Object.entries(categoryPrefs)) {
      if (!pref || typeof pref !== 'object') {
        continue
      }
      
      total_preferences++
      
      if (pref.weight >= 7) strong_likes++
      else if (pref.weight <= -7) strong_dislikes++
      
      if (new Date(pref.updated_at) > weekAgo) {
        recent_changes++
      }
    }
  }
  
  return {
    total_preferences,
    strong_likes,
    strong_dislikes,
    categories,
    recent_changes
  }
}