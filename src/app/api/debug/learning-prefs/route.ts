import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * 🔍 Debug endpoint to check learning preferences table and data
 * Only use in development for debugging database issues
 */

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🔍 Debug: Checking learning preferences for user:', user.id)

    // Check if user_learning_preferences_v2 table exists
    const { data: tableCheck, error: tableError } = await supabase
      .from('user_learning_preferences_v2')
      .select('*')
      .limit(1)

    console.log('🗃️ user_learning_preferences_v2 table check:', { 
      exists: !tableError, 
      error: tableError?.message,
      sample: tableCheck 
    })

    // Check if old table exists
    const { data: oldTableCheck, error: oldTableError } = await supabase
      .from('user_learning_preferences')
      .select('*')
      .limit(1)

    console.log('🗃️ user_learning_preferences (old) table check:', { 
      exists: !oldTableError, 
      error: oldTableError?.message,
      sample: oldTableCheck 
    })

    // Try to get user's learning preferences
    const { data: userPrefs, error: userPrefsError } = await supabase
      .from('user_learning_preferences_v2')
      .select('*')
      .eq('user_id', user.id)

    console.log('📊 User learning preferences:', { userPrefs, error: userPrefsError?.message })

    // Check if RPC functions exist
    const { data: rpcCheck1, error: rpcError1 } = await supabase
      .rpc('upsert_learning_preference_v2', {
        target_user_id: user.id,
        pref_category: 'test',
        pref_key: 'debug_test',
        pref_value: 'test_value',
        pref_weight: 1,
        pref_source: 'manual',
        pref_confidence: 1.0
      })

    console.log('🔧 upsert_learning_preference_v2 function test:', { 
      result: rpcCheck1, 
      error: rpcError1?.message 
    })

    const { data: rpcCheck2, error: rpcError2 } = await supabase
      .rpc('get_user_learning_summary_v2', { target_user_id: user.id })

    console.log('📊 get_user_learning_summary_v2 function test:', { 
      result: rpcCheck2, 
      error: rpcError2?.message 
    })

    // Get total count
    const { count, error: countError } = await supabase
      .from('user_learning_preferences_v2')
      .select('*', { count: 'exact', head: true })

    console.log('📈 Total records in learning preferences table:', { count, error: countError?.message })

    // Get sample records
    const { data: samples, error: sampleError } = await supabase
      .from('user_learning_preferences_v2')
      .select('user_id, preferences')
      .limit(3)

    console.log('🎯 Sample learning preference records:', { samples, error: sampleError?.message })

    return NextResponse.json({
      userId: user.id,
      v2TableExists: !tableError,
      v2TableError: tableError?.message,
      oldTableExists: !oldTableError,
      oldTableError: oldTableError?.message,
      userPreferences: userPrefs,
      userPreferencesError: userPrefsError?.message,
      upsertFunctionWorks: !rpcError1,
      upsertFunctionError: rpcError1?.message,
      summaryFunctionWorks: !rpcError2,
      summaryFunctionError: rpcError2?.message,
      totalRecords: count,
      sampleRecords: samples,
      sampleError: sampleError?.message
    })
    
  } catch (error) {
    console.error('Debug learning preferences endpoint error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    )
  }
}