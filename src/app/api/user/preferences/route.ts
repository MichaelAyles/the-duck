import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/supabase'
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
    preferredTopics: string[]
    dislikedTopics: string[]
  }
}

const DEFAULT_STARRED_MODELS = [
  'google/gemini-2.5-flash-preview-05-20',
  'google/gemini-2.5-pro-preview-05-06',
  'deepseek/deepseek-chat-v3-0324',
  'anthropic/claude-sonnet-4',
  'openai/gpt-4o-mini'
]

const DEFAULT_USER_PREFERENCES: UserPreferencesData = {
  starredModels: DEFAULT_STARRED_MODELS,
  primaryModel: DEFAULT_STARRED_MODELS[0],
  theme: 'system',
  responseTone: 'match',
  storageEnabled: true,
  explicitPreferences: {},
  writingStyle: {
    verbosity: 'medium',
    formality: 'neutral',
    technicalLevel: 'intermediate',
    preferredTopics: [],
    dislikedTopics: []
  }
}

function getTop5Models(allModels: any[]): string[] {
  if (!allModels || allModels.length === 0) {
    return DEFAULT_STARRED_MODELS
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

  const availableModelIds = allModels.map((model: any) => model.id)
  const availableTopModels = curatedTopModels.filter((modelId: string) => 
    availableModelIds.includes(modelId)
  )

  if (availableTopModels.length >= 5) {
    return availableTopModels.slice(0, 5)
  }

  const remainingModels = allModels
    .filter((model: any) => !availableTopModels.includes(model.id))
    .sort((a: any, b: any) => {
      const aIsFree = a.id.includes(':free') || (a.pricing?.prompt === 0 && a.pricing?.completion === 0)
      const bIsFree = b.id.includes(':free') || (b.pricing?.prompt === 0 && b.pricing?.completion === 0)
      
      if (aIsFree !== bIsFree) {
        return aIsFree ? 1 : -1
      }
      
      const contextDiff = (b.context_length || 0) - (a.context_length || 0)
      if (contextDiff !== 0) {
        return contextDiff
      }
      
      const providerScore = (model: any) => {
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
    .map((model: any) => model.id)

  return [...availableTopModels, ...remainingModels].slice(0, 5)
}

async function createUserPreferencesWithDynamicDefaults(userId: string): Promise<UserPreferencesData> {
  try {
    let dynamicStarredModels = [...DEFAULT_STARRED_MODELS]
    
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

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Try to get existing preferences
    const { data, error } = await supabase
      .from('user_preferences')
      .select('preferences')
      .eq('user_id', user.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No preferences found, create defaults
        const defaultPrefs = await createUserPreferencesWithDynamicDefaults(user.id)
        
        const { data: newData, error: createError } = await supabase
          .from('user_preferences')
          .insert([{
            user_id: user.id,
            preferences: defaultPrefs
          }])
          .select('preferences')
          .single()

        if (createError) {
          console.error('Failed to create user preferences:', createError)
          return NextResponse.json(
            { error: 'Failed to create user preferences' },
            { status: 500 }
          )
        }

        return NextResponse.json({ preferences: newData.preferences })
      }
      
      console.error('Failed to fetch user preferences:', error)
      return NextResponse.json(
        { error: 'Failed to fetch user preferences' },
        { status: 500 }
      )
    }

    return NextResponse.json({ preferences: data.preferences })
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const updates = body as Partial<UserPreferencesData>

    // Get current preferences first
    const { data: currentData, error: fetchError } = await supabase
      .from('user_preferences')
      .select('preferences')
      .eq('user_id', user.id)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Failed to fetch current preferences:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch current preferences' },
        { status: 500 }
      )
    }

    // Merge preferences
    const currentPrefs = currentData?.preferences as UserPreferencesData || DEFAULT_USER_PREFERENCES
    const updatedPrefs = {
      ...currentPrefs,
      ...updates,
      writingStyle: {
        ...currentPrefs.writingStyle,
        ...updates.writingStyle
      }
    }

    // Update or insert preferences
    const { data, error } = await supabase
      .from('user_preferences')
      .upsert([{
        user_id: user.id,
        preferences: updatedPrefs,
        updated_at: new Date().toISOString()
      }], {
        onConflict: 'user_id'
      })
      .select('preferences')
      .single()

    if (error) {
      console.error('Failed to update user preferences:', error)
      return NextResponse.json(
        { error: 'Failed to update user preferences' },
        { status: 500 }
      )
    }

    return NextResponse.json({ preferences: data.preferences })
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
      .select('preferences')
      .eq('user_id', user.id)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Failed to fetch current preferences:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch current preferences' },
        { status: 500 }
      )
    }

    const currentPrefs = currentData?.preferences as UserPreferencesData || await createUserPreferencesWithDynamicDefaults(user.id)

    let updatedPrefs = { ...currentPrefs }

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

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }

    // Save updated preferences
    const { data, error } = await supabase
      .from('user_preferences')
      .upsert([{
        user_id: user.id,
        preferences: updatedPrefs,
        updated_at: new Date().toISOString()
      }], {
        onConflict: 'user_id'
      })
      .select('preferences')
      .single()

    if (error) {
      console.error('Failed to update user preferences:', error)
      return NextResponse.json(
        { error: 'Failed to update user preferences' },
        { status: 500 }
      )
    }

    return NextResponse.json({ preferences: data.preferences })
  } catch (error) {
    console.error('Error in POST /api/user/preferences:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}