import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { DEFAULT_ACTIVE_MODELS } from '@/lib/config'
import { OpenRouterClient } from '@/lib/openrouter'

export interface UserPreferencesData {
  starredModels: string[]
  primaryModel: string
  theme: 'light' | 'dark' | 'system'
  responseTone: 'match' | 'professional' | 'casual' | 'concise' | 'detailed'
  storageEnabled: boolean
  explicitPreferences: Record<string, unknown>
  writingStyle?: {
    verbosity: 'short' | 'medium' | 'long'
    formality: 'casual' | 'neutral' | 'formal'
    technicalLevel: 'basic' | 'intermediate' | 'advanced'
    activeTopics: string[]
    avoidedTopics: string[]
  }
}

const DEFAULT_USER_PREFERENCES: UserPreferencesData = {
  starredModels: [...DEFAULT_ACTIVE_MODELS],
  primaryModel: DEFAULT_ACTIVE_MODELS[0],
  theme: 'system',
  responseTone: 'match',
  storageEnabled: true,
  explicitPreferences: {},
  writingStyle: {
    verbosity: 'medium',
    formality: 'neutral',
    technicalLevel: 'intermediate',
    activeTopics: [],
    avoidedTopics: []
  }
}

interface OpenRouterModel {
  id: string
  name: string
  context_length?: number
  pricing?: {
    prompt?: number
    completion?: number
  }
}

function getTop5Models(allModels: OpenRouterModel[]): string[] {
  if (!allModels || allModels.length === 0) {
    return [...DEFAULT_ACTIVE_MODELS]
  }

  const curatedTopModels = [
    'google/gemini-2.5-flash-preview-05-20',
    'google/gemini-2.5-pro-preview-05-06', 
    'deepseek/deepseek-chat-v3-0324',
    'anthropic/claude-sonnet-4',
    'openai/gpt-4o-mini',
    'anthropic/claude-3.5-sonnet',
    'openai/gpt-4o',
    'google/gemini-flash-1.5',
    'google/gemini-pro-1.5',
    'meta-llama/llama-3.1-405b-instruct',
    'meta-llama/llama-3.1-70b-instruct',
    'anthropic/claude-3-haiku',
    'openai/gpt-3.5-turbo'
  ]

  const availableModelIds = allModels.map((model) => model.id)
  const availableTopModels = curatedTopModels.filter((modelId: string) => 
    availableModelIds.includes(modelId)
  )

  if (availableTopModels.length >= 5) {
    return availableTopModels.slice(0, 5)
  }

  const remainingModels = allModels
    .filter((model) => !availableTopModels.includes(model.id))
    .sort((a, b) => {
      const aIsFree = a.id.includes(':free') || (a.pricing?.prompt === 0 && a.pricing?.completion === 0)
      const bIsFree = b.id.includes(':free') || (b.pricing?.prompt === 0 && b.pricing?.completion === 0)
      
      if (aIsFree !== bIsFree) {
        return aIsFree ? 1 : -1
      }
      
      const contextDiff = (b.context_length || 0) - (a.context_length || 0)
      if (contextDiff !== 0) {
        return contextDiff
      }
      
      const providerScore = (model: OpenRouterModel) => {
        const provider = model.id.split('/')[0]
        const providerRanks: { [key: string]: number } = {
          'anthropic': 9,
          'openai': 8,
          'google': 7,
          'deepseek': 6,
          'meta-llama': 5,
          'mistralai': 4
        }
        return providerRanks[provider] || 0
      }
      
      const providerDiff = providerScore(b) - providerScore(a)
      if (providerDiff !== 0) {
        return providerDiff
      }
      
      return a.name.localeCompare(b.name)
    })
    .map((model) => model.id)

  return [...availableTopModels, ...remainingModels].slice(0, 5)
}

async function createUserPreferencesWithDynamicDefaults(): Promise<UserPreferencesData> {
  try {
    let dynamicStarredModels = [...DEFAULT_ACTIVE_MODELS]
    
    try {
      const openRouterClient = new OpenRouterClient()
      const allModels = await openRouterClient.getModels()
      const top5Models = getTop5Models(allModels)
      
      if (top5Models.length > 0) {
        dynamicStarredModels = top5Models
        console.log('✨ Using dynamic top 5 models for new user:', top5Models)
      }
    } catch (modelError) {
      console.warn('Failed to get dynamic models, using defaults:', modelError)
    }

    return {
      ...DEFAULT_USER_PREFERENCES,
      starredModels: dynamicStarredModels,
      primaryModel: dynamicStarredModels[0] || DEFAULT_USER_PREFERENCES.primaryModel
    }
  } catch (error) {
    console.error('Error creating user preferences with dynamic defaults:', error)
    throw error
  }
}

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      console.log('🔒 User preferences GET: No authenticated user')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('👤 User preferences GET: Fetching for user:', user.id)

    // First check if the table exists and its structure
    const { error: tableError } = await supabase
      .from('user_preferences')
      .select('*')
      .limit(0)

    console.log('🗃️ Table structure check:', { tableExists: !tableError, error: tableError?.message })

    // Try to get existing preferences
    const { data, error } = await supabase
      .from('user_preferences')
      .select('starred_models, theme, default_model')
      .eq('user_id', user.id)
      .single()

    console.log('🔍 Database query result:', { data, error: error?.code || 'none' })

    if (error) {
      if (error.code === 'PGRST116') {
        // No preferences found, create defaults
        console.log('📝 No preferences found, creating defaults for user:', user.id)
        const defaultPrefs = await createUserPreferencesWithDynamicDefaults()
        console.log('🎯 Default preferences generated:', defaultPrefs)
        
        const insertData = {
          user_id: user.id,
          starred_models: defaultPrefs.starredModels,
          theme: defaultPrefs.theme,
          default_model: defaultPrefs.primaryModel
        }
        console.log('💾 Inserting to database:', insertData)
        
        const { data: newData, error: createError } = await supabase
          .from('user_preferences')
          .insert([insertData])
          .select('starred_models, theme, default_model')
          .single()

        console.log('✅ Insert result:', { newData, error: createError?.code || 'none' })

        if (createError) {
          // Handle unique constraint violation for user preferences
          if (createError.code === '23505') {
            console.log('🔄 Race condition detected, fetching existing preferences')
            // Race condition - another request created preferences, fetch them
            const { data: existingData } = await supabase
              .from('user_preferences')
              .select('starred_models, theme, default_model')
              .eq('user_id', user.id)
              .single()
            
            console.log('🔍 Existing data after race condition:', existingData)
            
            if (existingData) {
              const apiPreferences = {
                ...defaultPrefs,
                starredModels: existingData.starred_models || [],
                theme: existingData.theme || 'system',
                primaryModel: existingData.default_model || defaultPrefs.primaryModel
              }
              console.log('📤 Returning preferences after race condition:', apiPreferences)
              return NextResponse.json({ preferences: apiPreferences })
            }
          }
          
          console.error('❌ Failed to create user preferences:', createError)
          return NextResponse.json(
            { error: 'Failed to create user preferences' },
            { status: 500 }
          )
        }

        // Transform SQL columns back to API format
        const apiPreferences = {
          ...defaultPrefs,
          starredModels: newData.starred_models || [],
          theme: newData.theme || 'system',
          primaryModel: newData.default_model || defaultPrefs.primaryModel
        }
        
        console.log('📤 Returning newly created preferences:', apiPreferences)
        return NextResponse.json({ preferences: apiPreferences })
      }
      
      console.error('Failed to fetch user preferences:', error)
      return NextResponse.json(
        { error: 'Failed to fetch user preferences' },
        { status: 500 }
      )
    }

    // Transform SQL columns to API format
    console.log('🔄 Transforming existing data to API format')
    const defaultPrefs = await createUserPreferencesWithDynamicDefaults()
    const apiPreferences = {
      ...defaultPrefs,
      starredModels: data.starred_models || [],
      theme: data.theme || 'system',
      primaryModel: data.default_model || defaultPrefs.primaryModel
    }
    
    console.log('📤 Returning existing preferences:', apiPreferences)
    return NextResponse.json({ preferences: apiPreferences })
  } catch (error) {
    console.error('Error in GET /api/user/preferences:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      console.log('🔒 User preferences PUT: No authenticated user')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const updates = body as Partial<UserPreferencesData>
    console.log('📝 User preferences PUT: Updates for user:', user.id, updates)

    // Get current preferences first
    const { data: currentData, error: fetchError } = await supabase
      .from('user_preferences')
      .select('starred_models, theme, default_model')
      .eq('user_id', user.id)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Failed to fetch current preferences:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch current preferences' },
        { status: 500 }
      )
    }

    // Merge preferences with SQL column structure
    const currentPrefs: UserPreferencesData = currentData ? {
      ...DEFAULT_USER_PREFERENCES,
      starredModels: currentData.starred_models || [],
      theme: currentData.theme || 'system',
      primaryModel: currentData.default_model || DEFAULT_USER_PREFERENCES.primaryModel
    } : DEFAULT_USER_PREFERENCES
    
    const updatedPrefs = {
      ...currentPrefs,
      ...updates,
      writingStyle: {
        ...currentPrefs.writingStyle,
        ...updates.writingStyle
      }
    }

    // Update or insert preferences using individual columns
    const upsertData = {
      user_id: user.id,
      starred_models: updatedPrefs.starredModels,
      theme: updatedPrefs.theme,
      default_model: updatedPrefs.primaryModel
    }
    console.log('💾 Upserting preferences to database:', upsertData)
    
    const { data, error } = await supabase
      .from('user_preferences')
      .upsert([upsertData], {
        onConflict: 'user_id'
      })
      .select('starred_models, theme, default_model')
      .single()

    console.log('✅ Upsert result:', { data, error: error?.code || 'none' })

    if (error) {
      // Handle specific constraint errors
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Preferences update conflict - please try again' },
          { status: 409 }
        )
      } else if (error.code === '23503') {
        return NextResponse.json(
          { error: 'Invalid user reference' },
          { status: 400 }
        )
      }
      
      console.error('Failed to update user preferences:', error)
      return NextResponse.json(
        { error: 'Failed to update user preferences' },
        { status: 500 }
      )
    }

    // Transform back to API format
    const apiPreferences = {
      ...updatedPrefs,
      starredModels: data.starred_models || [],
      theme: data.theme || 'system',
      primaryModel: data.default_model || updatedPrefs.primaryModel
    }
    
    console.log('📤 Returning updated preferences (PUT):', apiPreferences)
    return NextResponse.json({ preferences: apiPreferences })
  } catch (error) {
    console.error('Error in PUT /api/user/preferences:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, modelId } = body

    if (!action) {
      return NextResponse.json(
        { error: 'Missing action' },
        { status: 400 }
      )
    }

    // Get current preferences
    const { data: currentData, error: fetchError } = await supabase
      .from('user_preferences')
      .select('starred_models, theme, default_model')
      .eq('user_id', user.id)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Failed to fetch current preferences:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch current preferences' },
        { status: 500 }
      )
    }

    // Transform SQL columns to API format
    const currentPrefs: UserPreferencesData = currentData ? {
      ...await createUserPreferencesWithDynamicDefaults(),
      starredModels: currentData.starred_models || [],
      theme: currentData.theme || 'system',
      primaryModel: currentData.default_model || DEFAULT_USER_PREFERENCES.primaryModel
    } : await createUserPreferencesWithDynamicDefaults()

    const updatedPrefs = { ...currentPrefs }

    // Handle different actions
    switch (action) {
      case 'toggleStarred':
        if (!modelId) {
          return NextResponse.json(
            { error: 'Missing modelId for toggleStarred action' },
            { status: 400 }
          )
        }
        
        const starredModels = [...currentPrefs.starredModels]
        const index = starredModels.indexOf(modelId)
        
        if (index > -1) {
          starredModels.splice(index, 1)
        } else {
          starredModels.push(modelId)
        }
        
        updatedPrefs.starredModels = starredModels
        break

      case 'setPrimary':
        if (!modelId) {
          return NextResponse.json(
            { error: 'Missing modelId for setPrimary action' },
            { status: 400 }
          )
        }
        
        // Ensure the model is starred when set as primary
        if (!updatedPrefs.starredModels.includes(modelId)) {
          updatedPrefs.starredModels.push(modelId)
        }
        
        updatedPrefs.primaryModel = modelId
        break

      case 'resetModels':
        // Reset to default model preferences
        const defaultPrefs = await createUserPreferencesWithDynamicDefaults()
        updatedPrefs.starredModels = [...defaultPrefs.starredModels]
        updatedPrefs.primaryModel = defaultPrefs.primaryModel
        break

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }

    // Save updated preferences using individual columns
    const { data, error } = await supabase
      .from('user_preferences')
      .upsert([{
        user_id: user.id,
        starred_models: updatedPrefs.starredModels,
        theme: updatedPrefs.theme,
        default_model: updatedPrefs.primaryModel
      }], {
        onConflict: 'user_id'
      })
      .select('starred_models, theme, default_model')
      .single()

    if (error) {
      // Handle specific constraint errors
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Preferences update conflict - please try again' },
          { status: 409 }
        )
      } else if (error.code === '23503') {
        return NextResponse.json(
          { error: 'Invalid user reference' },
          { status: 400 }
        )
      }
      
      console.error('Failed to update user preferences:', error)
      return NextResponse.json(
        { error: 'Failed to update user preferences' },
        { status: 500 }
      )
    }

    // Transform back to API format
    const apiPreferences = {
      ...updatedPrefs,
      starredModels: data.starred_models || [],
      theme: data.theme || 'system',
      primaryModel: data.default_model || updatedPrefs.primaryModel
    }
    
    return NextResponse.json({ preferences: apiPreferences })
  } catch (error) {
    console.error('Error in POST /api/user/preferences:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}