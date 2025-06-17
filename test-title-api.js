// Test the title generation API directly
const { default: fetch } = require('node-fetch');

async function testTitleGeneration() {
  console.log('=== Testing Title Generation API ===\n');
  
  // Test data
  const testMessages = [
    { id: '1', role: 'user', content: 'What is the capital of France?' },
    { id: '2', role: 'assistant', content: 'The capital of France is Paris. It is located in the north-central part of the country and is known for its iconic landmarks like the Eiffel Tower, Louvre Museum, and Notre-Dame Cathedral.' }
  ];
  
  const testSessionId = 'test-session-123';
  
  console.log('Test messages:');
  testMessages.forEach((msg, i) => {
    console.log(`  ${i + 1}. ${msg.role}: ${msg.content.slice(0, 50)}...`);
  });
  console.log();
  
  // Check if OpenRouter API key is available
  console.log('Environment check:');
  console.log('- OPENROUTER_API_KEY available:', !!process.env.OPENROUTER_API_KEY);
  console.log('- NODE_ENV:', process.env.NODE_ENV || 'undefined');
  console.log();
  
  // Test the OpenRouter API call directly
  if (process.env.OPENROUTER_API_KEY) {
    console.log('🔑 Testing OpenRouter API call directly...');
    
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',
        },
        body: JSON.stringify({
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
            ...testMessages.map((msg) => ({
              role: msg.role === 'system' ? 'assistant' : msg.role,
              content: msg.content.length > 200 ? msg.content.slice(0, 200) + '...' : msg.content
            }))
          ],
          temperature: 0.3,
          max_tokens: 40,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ OpenRouter API Response:');
        console.log('- Status:', response.status);
        console.log('- Data:', JSON.stringify(data, null, 2));
        
        if (data.choices?.[0]?.message?.content) {
          const aiTitle = data.choices[0].message.content.trim();
          console.log('🤖 Generated AI Title:', `"${aiTitle}"`);
          
          // Clean up the title
          const cleanTitle = aiTitle
            .replace(/['"]/g, '')
            .replace(/[^\w\s-]/g, '')
            .trim();
          console.log('🧹 Cleaned Title:', `"${cleanTitle}"`);
        } else {
          console.log('❌ No content in AI response');
        }
      } else {
        const errorText = await response.text();
        console.log('❌ OpenRouter API Error:');
        console.log('- Status:', response.status, response.statusText);
        console.log('- Error:', errorText);
      }
    } catch (error) {
      console.log('❌ OpenRouter API Exception:', error.message);
    }
  } else {
    console.log('❌ No OpenRouter API key found, skipping AI test');
  }
  
  console.log('\n=== Testing Fallback Title Generation ===');
  
  // Test the fallback function
  function createFallbackTitle(messages) {
    const userMessages = messages.filter(msg => 
      msg.role === 'user' && 
      msg.content && 
      msg.content.trim().length > 0 &&
      msg.id !== "welcome-message"
    );
    
    if (userMessages.length === 0) {
      const nonSystemMessages = messages.filter(msg => 
        msg.role !== 'system' && 
        msg.content && 
        msg.content.trim().length > 0 &&
        msg.id !== "welcome-message"
      );
      
      if (nonSystemMessages.length === 0) return 'New Chat';
      
      const firstMessage = nonSystemMessages[0];
      const words = firstMessage.content.trim().split(' ').slice(0, 4);
      let title = words.join(' ');
      
      if (title.length > 30) {
        title = title.slice(0, 27) + '...';
      }
      
      return title || 'New Chat';
    }
    
    const firstUserMessage = userMessages[0];
    const words = firstUserMessage.content.trim().split(' ').slice(0, 4);
    let title = words.join(' ');
    
    if (title.length > 30) {
      title = title.slice(0, 27) + '...';
    }
    
    return title || 'New Chat';
  }
  
  const fallbackTitle = createFallbackTitle(testMessages);
  console.log('📝 Fallback Title:', `"${fallbackTitle}"`);
  
  // Test different scenarios
  console.log('\n=== Testing Edge Cases ===');
  
  // Assistant message first
  const assistantFirstMessages = [
    { id: '2', role: 'assistant', content: 'The capital of France is Paris.' },
    { id: '1', role: 'user', content: 'What is the capital of France?' }
  ];
  console.log('Assistant first:', `"${createFallbackTitle(assistantFirstMessages)}"`);
  
  // No user messages
  const noUserMessages = [
    { id: '1', role: 'system', content: 'You are helpful.' },
    { id: '2', role: 'assistant', content: 'Hello! How can I help?' }
  ];
  console.log('No user messages:', `"${createFallbackTitle(noUserMessages)}"`);
  
  // With welcome message
  const withWelcome = [
    { id: 'welcome-message', role: 'assistant', content: 'Welcome!' },
    { id: '1', role: 'user', content: 'How do I learn Python?' },
    { id: '2', role: 'assistant', content: 'Python is a great language...' }
  ];
  console.log('With welcome message:', `"${createFallbackTitle(withWelcome)}"`);
}

// Run the test
testTitleGeneration().catch(console.error);