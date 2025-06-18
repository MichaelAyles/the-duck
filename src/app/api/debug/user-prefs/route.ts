import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * 🔍 Debug endpoint to check user preferences table and data
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

    console.log('🔍 Debug: Checking user preferences for user:', user.id)

    // Check if table exists by trying to describe it
    const { data: tableCheck, error: tableError } = await supabase
      .from('user_preferences')
      .select('*')
      .limit(1)

    console.log('🗃️ Table existence check:', { 
      exists: !tableError, 
      error: tableError?.message,
      sample: tableCheck 
    })

    // Try to get all columns for this user
    const { data: allData, error: allError } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)

    console.log('📊 All user preferences data:', { allData, error: allError?.message })

    // Try to get count of total records
    const { count, error: countError } = await supabase
      .from('user_preferences')
      .select('*', { count: 'exact', head: true })

    console.log('📈 Total records in table:', { count, error: countError?.message })

    // Try to get a few sample records
    const { data: samples, error: sampleError } = await supabase
      .from('user_preferences')
      .select('user_id, starred_models, theme, default_model')
      .limit(3)

    console.log('🎯 Sample records:', { samples, error: sampleError?.message })

    return NextResponse.json({
      userId: user.id,
      tableExists: !tableError,
      tableError: tableError?.message,
      userPreferences: allData,
      userPreferencesError: allError?.message,
      totalRecords: count,
      sampleRecords: samples,
      sampleError: sampleError?.message
    })
    
  } catch (error) {
    console.error('Debug endpoint error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    )
  }
}