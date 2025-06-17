// Simple test script to verify title generation logic

function createFallbackTitle(messages) {
  // Filter out system messages and find the first user message
  const userMessages = messages.filter(msg => 
    msg.role === 'user' && 
    msg.content && 
    msg.content.trim().length > 0 &&
    msg.id !== "welcome-message"
  )
  
  if (userMessages.length === 0) {
    // If no user messages, try to find any non-system message
    const nonSystemMessages = messages.filter(msg => 
      msg.role !== 'system' && 
      msg.content && 
      msg.content.trim().length > 0 &&
      msg.id !== "welcome-message"
    )
    
    if (nonSystemMessages.length === 0) return 'New Chat'
    
    // Use the first non-system message as fallback
    const firstMessage = nonSystemMessages[0]
    const words = firstMessage.content.trim().split(' ').slice(0, 4)
    let title = words.join(' ')
    
    if (title.length > 30) {
      title = title.slice(0, 27) + '...'
    }
    
    return title || 'New Chat'
  }
  
  // Use the first user message
  const firstUserMessage = userMessages[0]
  const words = firstUserMessage.content.trim().split(' ').slice(0, 4)
  let title = words.join(' ')
  
  // Truncate if too long
  if (title.length > 30) {
    title = title.slice(0, 27) + '...'
  }
  
  return title || 'New Chat'
}

// Test cases
console.log('=== Title Generation Tests ===\n')

// Test 1: Normal conversation
const test1 = [
  { id: '1', role: 'user', content: 'What is the capital of France?' },
  { id: '2', role: 'assistant', content: 'The capital of France is Paris.' }
]
console.log('Test 1 (Normal conversation):')
console.log('Messages:', test1.map(m => `${m.role}: ${m.content.slice(0, 30)}...`))
console.log('Generated title:', createFallbackTitle(test1))
console.log()

// Test 2: Assistant message first (wrong order)
const test2 = [
  { id: '2', role: 'assistant', content: 'The capital of France is Paris.' },
  { id: '1', role: 'user', content: 'What is the capital of France?' }
]
console.log('Test 2 (Assistant first - wrong order):')
console.log('Messages:', test2.map(m => `${m.role}: ${m.content.slice(0, 30)}...`))
console.log('Generated title:', createFallbackTitle(test2))
console.log()

// Test 3: No user messages
const test3 = [
  { id: '1', role: 'system', content: 'You are a helpful assistant.' },
  { id: '2', role: 'assistant', content: 'Hello! How can I help you today?' }
]
console.log('Test 3 (No user messages):')
console.log('Messages:', test3.map(m => `${m.role}: ${m.content.slice(0, 30)}...`))
console.log('Generated title:', createFallbackTitle(test3))
console.log()

// Test 4: Empty messages
const test4 = []
console.log('Test 4 (Empty messages):')
console.log('Messages:', test4)
console.log('Generated title:', createFallbackTitle(test4))
console.log()

// Test 5: Welcome message filtering
const test5 = [
  { id: 'welcome-message', role: 'assistant', content: 'Welcome to The Duck!' },
  { id: '1', role: 'user', content: 'How do I learn JavaScript?' },
  { id: '2', role: 'assistant', content: 'JavaScript is a programming language...' }
]
console.log('Test 5 (With welcome message):')
console.log('Messages:', test5.map(m => `${m.role}: ${m.content.slice(0, 30)}...`))
console.log('Generated title:', createFallbackTitle(test5))
console.log()

// Test 6: Long user message
const test6 = [
  { id: '1', role: 'user', content: 'Can you please explain to me in great detail how quantum computing works and what are the main differences between classical and quantum computers?' },
  { id: '2', role: 'assistant', content: 'Quantum computing is a revolutionary approach...' }
]
console.log('Test 6 (Long user message):')
console.log('Messages:', test6.map(m => `${m.role}: ${m.content.slice(0, 50)}...`))
console.log('Generated title:', createFallbackTitle(test6))
console.log()