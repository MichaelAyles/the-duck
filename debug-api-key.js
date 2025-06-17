// Debug API key issue
console.log('=== API Key Debug ===');
console.log('Raw OPENROUTER_API_KEY:', JSON.stringify(process.env.OPENROUTER_API_KEY));
console.log('Length:', process.env.OPENROUTER_API_KEY?.length);
console.log('First char:', process.env.OPENROUTER_API_KEY?.charCodeAt(0));
console.log('Last char:', process.env.OPENROUTER_API_KEY?.charCodeAt(process.env.OPENROUTER_API_KEY.length - 1));

// Clean the API key
const cleanApiKey = process.env.OPENROUTER_API_KEY?.replace(/^["']|["']$/g, '');
console.log('Cleaned API key:', cleanApiKey?.substring(0, 20) + '...');
console.log('Cleaned length:', cleanApiKey?.length);

// Test with cleaned key
const { default: fetch } = require('node-fetch');

async function testWithCleanedKey() {
  console.log('\n=== Testing with cleaned API key ===');
  
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cleanApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-lite-001',
        messages: [
          {
            role: 'system',
            content: 'You are a title generator. Create a short title for this conversation.'
          },
          {
            role: 'user',
            content: 'What is the capital of France?'
          }
        ],
        temperature: 0.3,
        max_tokens: 40,
      }),
    });
    
    console.log('Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Success! Response:', JSON.stringify(data, null, 2));
    } else {
      const errorText = await response.text();
      console.log('❌ Error response:', errorText);
    }
  } catch (error) {
    console.log('❌ Exception:', error.message);
  }
}

testWithCleanedKey();