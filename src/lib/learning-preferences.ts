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

export interface FormattedPreferences {
  strongLikes: string[]
  moderateLikes: string[]
  strongDislikes: string[]
  moderateDislikes: string[]
  topics: string[]
  styles: string[]
  approaches: string[]
}

/**
 * Retrieve user's learning preferences from the database
 */
export async function getUserLearningPreferences(userId: string): Promise<LearningPreference[]> {
  const supabase = await createClient()
  
  const { data: preferences, error } = await supabase
    .from('user_learning_preferences')
    .select('*')
    .eq('user_id', userId)
    .order('weight', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(50) // Limit to most important preferences to avoid token bloat

  if (error) {
    console.error('Failed to fetch learning preferences:', error)
    return []
  }

  return preferences || []
}

/**
 * Format learning preferences into categories for use in system prompts
 */
export function formatPreferencesForPrompt(preferences: LearningPreference[]): FormattedPreferences {
  const formatted: FormattedPreferences = {
    strongLikes: [],
    moderateLikes: [],
    strongDislikes: [],
    moderateDislikes: [],
    topics: [],
    styles: [],
    approaches: []
  }

  preferences.forEach(pref => {
    const description = pref.preference_value 
      ? `${pref.preference_key} (${pref.preference_value})`
      : pref.preference_key

    // Categorize by weight
    if (pref.weight >= 7) {
      formatted.strongLikes.push(description)
    } else if (pref.weight >= 3) {
      formatted.moderateLikes.push(description)
    } else if (pref.weight <= -7) {
      formatted.strongDislikes.push(description)
    } else if (pref.weight <= -3) {
      formatted.moderateDislikes.push(description)
    }

    // Categorize by type
    switch (pref.category) {
      case 'topic':
      case 'subject':
        formatted.topics.push(description)
        break
      case 'style':
      case 'tone':
      case 'format':
        formatted.styles.push(description)
        break
      case 'approach':
      case 'explanation':
      case 'examples':
        formatted.approaches.push(description)
        break
    }
  })

  return formatted
}

/**
 * Generate a learning preferences section for the system prompt
 */
export function generatePreferencesPrompt(preferences: LearningPreference[]): string {
  if (preferences.length === 0) {
    return ''
  }

  const formatted = formatPreferencesForPrompt(preferences)
  const sections: string[] = []

  // Strong preferences section
  if (formatted.strongLikes.length > 0 || formatted.strongDislikes.length > 0) {
    sections.push('\n## User Preferences')
    
    if (formatted.strongLikes.length > 0) {
      sections.push(`**Strong Interests:** ${formatted.strongLikes.join(', ')}`)
    }
    
    if (formatted.moderateLikes.length > 0) {
      sections.push(`**Interests:** ${formatted.moderateLikes.join(', ')}`)
    }
    
    if (formatted.strongDislikes.length > 0) {
      sections.push(`**Avoid:** ${formatted.strongDislikes.join(', ')}`)
    }
    
    if (formatted.moderateDislikes.length > 0) {
      sections.push(`**Less Preferred:** ${formatted.moderateDislikes.join(', ')}`)
    }
  }

  // Style preferences
  if (formatted.styles.length > 0) {
    sections.push(`**Communication Style:** ${formatted.styles.join(', ')}`)
  }

  // Approach preferences
  if (formatted.approaches.length > 0) {
    sections.push(`**Preferred Approaches:** ${formatted.approaches.join(', ')}`)
  }

  if (sections.length > 0) {
    sections.push('\nUse these preferences to tailor your responses when relevant. Reference the user\'s interests naturally and avoid topics they dislike unless specifically asked.')
  }

  return sections.join('\n')
}

/**
 * Enhanced system prompt that incorporates user learning preferences
 */
export function createPersonalizedSystemPrompt(
  preferences: LearningPreference[], 
  tone: string = "match-user"
): string {
  const basePrompt = tone === "duck" 
    ? "You are The Duck, a friendly AI assistant. You must respond only with 'quack' repeated in various patterns. Express different emotions and meanings through variations in your quacking - use 'Quack!' for excitement, 'quack quack' for agreement, 'Quack?' for questions, etc."
    : "You are The Duck, a helpful AI assistant. You are friendly, knowledgeable, and direct in your responses. Answer questions clearly and helpfully without excessive duck-themed language or metaphors. Focus on being genuinely useful rather than overly playful."

  if (tone === "duck") {
    return basePrompt // Don't add preferences to duck mode
  }

  const preferencesSection = generatePreferencesPrompt(preferences)
  
  return basePrompt + preferencesSection
}