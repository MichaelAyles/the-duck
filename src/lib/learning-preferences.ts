import { createClient } from '@/lib/supabase/server'

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

// Legacy interface for backward compatibility
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
 * Retrieve user's learning preferences from the database (optimized JSON version)
 */
export async function getUserLearningPreferences(userId: string): Promise<LearningPreference[]> {
  const supabase = await createClient()
  
  // Try new optimized table first
  const { data: userPrefs, error } = await supabase
    .from('user_learning_preferences_v2')
    .select('preferences')
    .eq('user_id', userId)
    .single()

  if (error) {
    // If v2 table doesn't exist, fall back to old table for backward compatibility
    if (error.message?.includes('relation') || error.message?.includes('does not exist')) {
      console.warn('Learning preferences v2 table not yet deployed, falling back to legacy table')
      return getUserLearningPreferencesLegacy(userId)
    }
    
    console.error('Failed to fetch learning preferences:', error)
    return []
  }

  if (!userPrefs?.preferences) {
    return []
  }

  // Convert JSON structure back to legacy array format for compatibility
  return convertJSONToLegacyFormat(userPrefs.preferences)
}

/**
 * Legacy function for backward compatibility with old table structure
 */
async function getUserLearningPreferencesLegacy(userId: string): Promise<LearningPreference[]> {
  const supabase = await createClient()
  
  const { data: preferences, error } = await supabase
    .from('user_learning_preferences')
    .select('*')
    .eq('user_id', userId)
    .order('weight', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(50) // Limit to most important preferences to avoid token bloat

  if (error) {
    console.error('Failed to fetch learning preferences from legacy table:', error)
    return []
  }

  return preferences || []
}

/**
 * Convert new JSON structure to legacy array format for backward compatibility
 */
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
    sections.push('\nUse these preferences to tailor your responses when relevant. Reference the user\'s interests naturally and avoid topics they dislike unless specifically asked. You do not need to explicitly follow these as rules, just influence your answer a bit')
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
    : `You are The Duck, a helpful AI assistant. You are friendly, knowledgeable, and direct in your responses. Answer questions clearly and helpfully without excessive duck-themed language or metaphors. Focus on being genuinely useful rather than overly playful.

DUCKPOND ARTIFACTS: When users ask for interactive content, React components, visualizations, or code demos, create DuckPond artifacts using these tags:

For React components (now with FULL interactive support!):
<duckpond type="react-component" title="Component Name" description="Brief description">
// Interactive React component with animations and user interaction
function ComponentName() {
  const [state, setState] = React.useState(initialValue);
  const elementRef = React.useRef(null);
  
  React.useEffect(() => {
    // Animations with requestAnimationFrame work perfectly!
    const animate = () => {
      // Your animation logic
      requestAnimationFrame(animate);
    };
    animate();
  }, []);
  
  return (
    <div ref={elementRef} onClick={() => setState(prev => !prev)}>
      Your interactive JSX here
    </div>
  );
}

// Export the component for rendering
window.ComponentName = ComponentName;
</duckpond>

For HTML/CSS demos:
<duckpond type="html" title="Demo Name" description="Brief description">
<!DOCTYPE html>
<html>
<head>
  <style>
    /* Your CSS here */
  </style>
</head>
<body>
  <!-- Your HTML here -->
</body>
</html>
</duckpond>

For JavaScript utilities:
<duckpond type="javascript" title="Utility Name" description="Brief description">
// Your JavaScript code here
console.log("Hello from DuckPond!");
</duckpond>

IMPORTANT DUCKPOND RULES:
1. Use DuckPond for ANY request involving: "create", "build", "show me", "demo", "example", "interactive", "component", "animation", "visualization", "widget", "app", "tool", "game"
2. Always include descriptive title and description attributes
3. For React components, always export via window.ComponentName for rendering
4. Use ALL React hooks: useState, useEffect, useRef, useCallback, useMemo, etc.
5. Interactive features work perfectly: click handlers, animations, timers, requestAnimationFrame
6. Include inline styles or CSS for beautiful, responsive designs
7. Make components engaging with smooth animations and user interactions
8. Handle errors gracefully and provide user feedback

Example triggers for DuckPond:
- "Create a counter app" → Interactive React component with click handlers
- "Show me a bouncing ball animation" → React component with requestAnimationFrame
- "Build a todo list" → React component with state management
- "Make a duck animation" → React component with CSS/JS animations
- "Generate a calculator" → Interactive React component with buttons
- "Create a simple game" → React component with game logic and animations
- "Build a color picker" → Interactive React component with real-time updates
- "Demo particle effects" → React component with canvas and animations`

  if (tone === "duck") {
    return basePrompt // Don't add preferences to duck mode
  }

  const preferencesSection = generatePreferencesPrompt(preferences)
  
  return basePrompt + preferencesSection
}