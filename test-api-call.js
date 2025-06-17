// Test the title generation API call logic

const testMessages = [
  { id: '1', role: 'user', content: 'What is the capital of France?' },
  { id: '2', role: 'assistant', content: 'The capital of France is Paris. It is located in the north-central part of the country and is known for its iconic landmarks like the Eiffel Tower, Louvre Museum, and Notre-Dame Cathedral.' }
]

console.log('=== Testing API Call Logic ===\n')

// Test the message filtering and preparation
function prepareMessagesForAPI(messages) {
  // Filter out welcome message, system messages, and empty messages
  const conversationMessages = messages.filter(msg => 
    msg.id !== "welcome-message" && 
    msg.role !== "system" &&
    msg.metadata?.model !== "system" &&
    msg.content && 
    msg.content.trim().length > 0
  );
  
  console.log('Original messages:', messages.length)
  console.log('Filtered messages:', conversationMessages.length)
  console.log('Messages for API:')
  conversationMessages.forEach((msg, i) => {
    console.log(`  ${i + 1}. ${msg.role}: ${msg.content.slice(0, 50)}...`)
  })
  
  return conversationMessages
}

// Test the OpenRouter API request body
function createAPIRequestBody(messages, sessionId) {
  const relevantMessages = messages.slice(0, 6) // First 6 messages should be enough
  
  const requestBody = {
    model: 'google/gemini-2.0-flash-lite-001',
    messages: [
      {
        role: 'system',
        content: `You are a title generator. Create a short, descriptive title (2-5 words max) for this conversation. 

Rules:
- Maximum 5 words
- Be specific and descriptive
- Avoid generic words like "chat", "conversation", "help"
- Focus on the main topic or question
- Use title case
- No quotes or special characters
- Examples: "Python Data Analysis", "Recipe for Pasta", "React Hooks Guide", "Travel to Japan"

Respond with ONLY the title, nothing else.`
      },
      ...relevantMessages.map((msg) => ({
        role: msg.role === 'system' ? 'assistant' : msg.role,
        content: msg.content.length > 200 ? msg.content.slice(0, 200) + '...' : msg.content
      }))
    ],
    temperature: 0.3,
    max_tokens: 40,
  }
  
  return requestBody
}

console.log('\n=== Message Preparation ===')
const preparedMessages = prepareMessagesForAPI(testMessages)

console.log('\n=== API Request Body ===')
const requestBody = createAPIRequestBody(preparedMessages, 'test-session-id')
console.log('Request body:')
console.log(JSON.stringify(requestBody, null, 2))

console.log('\n=== Environment Check ===')
console.log('OPENROUTER_API_KEY available:', !!process.env.OPENROUTER_API_KEY)
console.log('NODE_ENV:', process.env.NODE_ENV)

// Test different message scenarios
console.log('\n=== Testing Different Message Scenarios ===')

// Scenario 1: Messages with system message
const messagesWithSystem = [
  { id: 'sys', role: 'system', content: 'You are a helpful assistant.' },
  { id: '1', role: 'user', content: 'How do I bake a chocolate cake?' },
  { id: '2', role: 'assistant', content: 'To bake a chocolate cake, you will need...' }
]

console.log('\nScenario 1: With system message')
prepareMessagesForAPI(messagesWithSystem)

// Scenario 2: Messages with welcome message
const messagesWithWelcome = [
  { id: 'welcome-message', role: 'assistant', content: 'Welcome to The Duck!' },
  { id: '1', role: 'user', content: 'Tell me about machine learning' },
  { id: '2', role: 'assistant', content: 'Machine learning is a subset of artificial intelligence...' }
]

console.log('\nScenario 2: With welcome message')
prepareMessagesForAPI(messagesWithWelcome)

// Scenario 3: Empty or invalid messages
const messagesWithEmpty = [
  { id: '1', role: 'user', content: '' },
  { id: '2', role: 'user', content: '   ' },
  { id: '3', role: 'user', content: 'Valid message' },
  { id: '4', role: 'assistant', content: 'Response to valid message' }
]

console.log('\nScenario 3: With empty messages')
prepareMessagesForAPI(messagesWithEmpty)