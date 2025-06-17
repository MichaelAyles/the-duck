// Test both summarize and generate-title endpoints
const { default: fetch } = require('node-fetch');

const testMessages = [
  { id: '1', role: 'user', content: 'What is the capital of France?' },
  { id: '2', role: 'assistant', content: 'The capital of France is Paris. It is located in the north-central part of the country and is known for its iconic landmarks like the Eiffel Tower, Louvre Museum, and Notre-Dame Cathedral.' },
  { id: '3', role: 'user', content: 'Tell me more about the Eiffel Tower' },
  { id: '4', role: 'assistant', content: 'The Eiffel Tower is a wrought-iron lattice tower on the Champ de Mars in Paris, France. It was constructed from 1887 to 1889 as the entrance to the 1889 World\'s Fair and was initially criticized by some of France\'s leading artists and intellectuals for its design.' }
];

async function testSummarizeEndpoint() {
  console.log('=== Testing Summarize Endpoint ===');
  
  try {
    const response = await fetch('http://localhost:12000/api/summarize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: testMessages,
        sessionId: 'test-session-123'
      }),
    });
    
    console.log('Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Summarize Success!');
      console.log('Summary:', data.summary);
      console.log('Key Topics:', data.keyTopics);
      console.log('Learning Preferences:', data.learningPreferences?.length || 0, 'preferences found');
    } else {
      const errorText = await response.text();
      console.log('❌ Summarize Error:', errorText);
    }
  } catch (error) {
    console.log('❌ Summarize Exception:', error.message);
  }
}

async function testGenerateTitleEndpoint() {
  console.log('\n=== Testing Generate Title Endpoint ===');
  
  try {
    const response = await fetch('http://localhost:12000/api/generate-title', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: testMessages,
        sessionId: 'test-session-123'
      }),
    });
    
    console.log('Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Generate Title Success!');
      console.log('Title:', data.title);
      console.log('Method:', data.method);
      console.log('Updated:', data.updated);
    } else {
      const errorText = await response.text();
      console.log('❌ Generate Title Error:', errorText);
    }
  } catch (error) {
    console.log('❌ Generate Title Exception:', error.message);
  }
}

async function runTests() {
  console.log('Testing API endpoints...\n');
  
  await testSummarizeEndpoint();
  await testGenerateTitleEndpoint();
  
  console.log('\n=== Tests Complete ===');
}

runTests().catch(console.error);