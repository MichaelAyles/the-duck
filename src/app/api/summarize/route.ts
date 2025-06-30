import { NextResponse } from 'next/server'
import { Message } from '@/types/chat'
import { createClient } from '@/lib/supabase/server'
import { nanoid } from 'nanoid'

// Helper function to create a fallback summary
function createFallbackSummary(messages: Message[]) {
  const userMessages = messages.filter(msg => msg.role === 'user')
  const assistantMessages = messages.filter(msg => msg.role === 'assistant')
  
  // Extract basic topics from user messages
  const keyTopics = userMessages
    .slice(0, 3) // Take first 3 user messages
    .map(msg => msg.content.split(' ').slice(0, 3).join(' ')) // First 3 words
    .filter(topic => topic.length > 0)

  return {
    summary: `Conversation with ${userMessages.length} user messages and ${assistantMessages.length} responses. Topics discussed included general questions and assistance.`,
    keyTopics: keyTopics.length > 0 ? keyTopics : ['general chat'],
    userPreferences: {
      explicit: {},
      implicit: {
        writingStyle: {
          formality: 0.5,
          verbosity: 0.5,
          technicalLevel: 0.5,
          activeResponseLength: 0.5
        }
      }
    },
    learningPreferences: []
  }
}

export async function POST(req: Request) {
  try {
    const { messages, sessionId } = await req.json()

    // Get authenticated user if we need to save the summary
    let userId: string | null = null
    if (sessionId) {
      const supabase = await createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (!authError && user) {
        userId = user.id
      }
    }

    // Check if OpenRouter API key is available
    if (!process.env.OPENROUTER_API_KEY) {
      console.warn('OpenRouter API key not configured, using fallback summary')
      return NextResponse.json(createFallbackSummary(messages))
    }

    // Clean the API key (remove surrounding quotes if present)
    const cleanApiKey = process.env.OPENROUTER_API_KEY.replace(/^["']|["']$/g, '')

    // Use OpenRouter's Gemini Flash model for cost-effective summarization
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cleanApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-lite-001',
        response_format: { type: "json_object" },
        messages: [
          {
            role: 'system',
            content: `You are an AI assistant tasked with analyzing a chat conversation and providing:
1. A concise summary of the main points discussed
2. Key topics covered
3. Analysis of the user's writing style and preferences
4. Specific learning preferences with weights from -10 (strong dislike) to +10 (strong like)

IMPORTANT: You MUST respond with ONLY a valid JSON object. Do not include any text before or after the JSON. Do not use markdown code blocks.

Format your response as a JSON object with the following structure:
{
  "summary": "Brief summary of the conversation",
  "keyTopics": ["topic1", "topic2", ...],
  "userPreferences": {
    "explicit": {
      // Any explicit preferences mentioned by the user
    },
    "implicit": {
      "writingStyle": {
        "formality": 0.5, // 0 = casual, 1 = formal
        "verbosity": 0.5, // 0 = concise, 1 = detailed
        "technicalLevel": 0.5, // 0 = basic, 1 = technical
        "activeResponseLength": 0.5 // 0 = short, 1 = long
      }
    }
  },
  "learningPreferences": [
    {
      "category": "topic|style|format|approach|subject|tone|complexity|examples|explanation",
      "preference_key": "specific preference identifier",
      "preference_value": "optional description",
      "weight": 5, // -10 to +10 based on user's apparent preference
      "confidence": 0.8 // 0.0 to 1.0 confidence in this assessment
    }
  ]
}

Extract specific learning preferences from the conversation. FOCUS ON ACTUAL CONTENT AND TOPICS, not just conversational patterns.

Look for:
- SPECIFIC TOPICS mentioned: animals, technology, food, sports, etc.
- Subject matter the user discusses: science, history, programming, etc.
- Concrete interests expressed: "I like goats", "I love programming", "I hate math"
- Explanation styles preferred: technical vs simple, detailed vs concise
- Response formats liked: code examples, step-by-step guides, analogies
- Communication approaches: direct answers vs explorative discussion
- Tone preferences: formal, casual, encouraging
- Complexity levels they're comfortable with

PRIORITIZE CONTENT OVER STYLE AND EXTRACT ALL PREFERENCES MENTIONED.

Examples:
- If user says "I like goats": {"category": "topic", "preference_key": "goats", "weight": 7}
- If user says "I love coffee but hate tea": 
  [{"category": "topic", "preference_key": "coffee", "weight": 8},
   {"category": "topic", "preference_key": "tea", "weight": -8}]
- If user says "I like cake" then "I like sheep": Extract BOTH preferences

EXTRACT UP TO 10 DIFFERENT PREFERENCES from the entire conversation.
Do NOT limit to recent messages - scan the FULL conversation for all stated preferences.

Assign weights based on:
- Explicit statements: "I love/hate X", "I prefer X", "I don't like X" = ±7 to ±10
- Strong engagement with topics: detailed follow-ups, enthusiasm about subject = +5 to +7
- Mild interest: positive responses, asking for more about topic = +2 to +5
- Neutral: no clear indication = 0
- Topic avoidance: changing subject, brief responses = -2 to -5
- Clear disinterest in topic: explicit confusion, frustration = -5 to -7
- Strong rejection of topic: "I don't want to discuss X" = -7 to -10`
          },
          ...messages.map((msg: Message) => ({
            role: msg.role,
            content: msg.content
          }))
        ],
        temperature: 0.3, // Lower temperature for more consistent analysis
      }),
    })

    if (!response.ok) {
      console.warn(`OpenRouter API failed (${response.status}), using fallback summary`)
      return NextResponse.json(createFallbackSummary(messages))
    }

    const data = await response.json()
    const summaryText = data.choices[0]?.message?.content

    if (!summaryText) {
      console.warn('No summary content received, using fallback')
      return NextResponse.json(createFallbackSummary(messages))
    }

    let cleanedText = summaryText.trim()
    
    try {
      // Clean the response by removing markdown code blocks if present
      
      // Remove ```json and ``` markers if present
      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '')
      } else if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '')
      }
      
      // Try to find JSON within the text if it's not pure JSON
      if (!cleanedText.startsWith('{')) {
        const jsonMatch = cleanedText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          cleanedText = jsonMatch[0]
        } else {
          // If no JSON found, the model returned plain text - use fallback
          console.warn('Model returned plain text instead of JSON, using fallback')
          return NextResponse.json(createFallbackSummary(messages))
        }
      }
      
      // Parse the cleaned JSON response
      const summary = JSON.parse(cleanedText)
      
      // Save summary to database if sessionId and userId are available
      if (sessionId && userId) {
        try {
          const supabase = await createClient()
          
          const summaryData = {
            id: nanoid(),
            session_id: sessionId,
            summary: summary.summary,
            key_topics: summary.keyTopics || [],
            user_preferences: summary.userPreferences || {},
            writing_style_analysis: summary.userPreferences?.implicit?.writingStyle || {},
          }

          const { error } = await supabase
            .from('chat_summaries')
            .upsert(summaryData, {
              onConflict: 'session_id',
              ignoreDuplicates: false,
            })

          if (error) {
            console.error('Failed to save chat summary to database:', error)
          } else {
            console.log(`✅ Saved chat summary for session: ${sessionId}`)
          }

          // Save learning preferences if they exist
          if (summary.learningPreferences && Array.isArray(summary.learningPreferences)) {
            for (const pref of summary.learningPreferences) {
              try {
                // Use the optimized v2 upsert function to add/update learning preferences
                const { error: prefError } = await supabase
                  .rpc('upsert_learning_preference_v2', {
                    target_user_id: userId,
                    pref_category: pref.category,
                    pref_key: pref.preference_key,
                    pref_value: pref.preference_value || null,
                    pref_weight: Math.max(-10, Math.min(10, Math.round(pref.weight || 0))), // Ensure valid range
                    pref_source: 'chat_summary',
                    pref_confidence: 0.8 // Default confidence for AI-generated preferences
                  })

                if (prefError) {
                  console.error(`Failed to save learning preference: ${pref.preference_key}`, prefError)
                } else {
                  console.log(`✅ Saved learning preference: ${pref.category}/${pref.preference_key} (weight: ${pref.weight})`)
                }
              } catch (prefSaveError) {
                console.error('Error saving individual learning preference:', prefSaveError)
              }
            }
            
            console.log(`✅ Processed ${summary.learningPreferences.length} learning preferences from chat summary`)
          }
        } catch (dbError) {
          console.error('Error saving summary to database:', dbError)
        }
      }
      
      return NextResponse.json(summary)
    } catch (parseError) {
      console.warn('Failed to parse summary JSON, using fallback:', parseError)
      if (process.env.NODE_ENV === 'development') {
        console.warn('Raw response was:', summaryText)
        console.warn('Cleaned text was:', cleanedText)
      }
      return NextResponse.json(createFallbackSummary(messages))
    }

  } catch (error) {
    console.error('Error in summarize endpoint:', error)
    // Return fallback summary instead of error
    const { messages } = await req.json().catch(() => ({ messages: [] }))
    return NextResponse.json(createFallbackSummary(messages))
  }
} 