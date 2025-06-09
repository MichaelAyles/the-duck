#!/usr/bin/env node

/**
 * 🚀 The Duck - Development Setup Script
 * 
 * This script helps new developers get up and running quickly by:
 * - Checking for required environment variables
 * - Validating the development environment
 * - Providing clear setup instructions
 */

const fs = require('fs');
const path = require('path');

console.log('🦆 Welcome to The Duck Development Setup!\n');

// Check if .env.local exists
const envLocalPath = path.join(process.cwd(), '.env.local');
const envExamplePath = path.join(process.cwd(), '.env.example');

if (!fs.existsSync(envLocalPath)) {
  console.log('❌ Missing .env.local file');
  
  if (fs.existsSync(envExamplePath)) {
    console.log('💡 Found .env.example file. To get started:');
    console.log('   1. Copy .env.example to .env.local:');
    console.log('      cp .env.example .env.local');
    console.log('   2. Edit .env.local with your actual API keys');
    console.log('   3. Run this script again to validate your setup\n');
  } else {
    console.log('💡 Create a .env.local file with the following variables:');
    console.log('   OPENROUTER_API_KEY="your-openrouter-key"');
    console.log('   DATABASE_URL="postgresql://localhost:5432/the_duck_chat"');
    console.log('   NEXT_PUBLIC_SUPABASE_URL="your-supabase-url"');
    console.log('   NEXT_PUBLIC_SUPABASE_ANON_KEY="your-supabase-key"\n');
  }
  
  process.exit(1);
}

console.log('✅ Found .env.local file');

// Load and validate environment variables
require('dotenv').config({ path: envLocalPath });

const requiredVars = [
  'OPENROUTER_API_KEY',
  'DATABASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY'
];

const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.log('❌ Missing required environment variables:');
  missingVars.forEach(varName => {
    console.log(`   • ${varName}`);
  });
  console.log('\n💡 Please add these variables to your .env.local file\n');
  process.exit(1);
}

console.log('✅ All required environment variables found');

// Validate API key formats
const validations = [
  {
    name: 'OPENROUTER_API_KEY',
    test: (val) => val.startsWith('sk-or-v1-'),
    message: 'Should start with "sk-or-v1-"'
  },
  {
    name: 'DATABASE_URL',
    test: (val) => val.startsWith('postgresql://'),
    message: 'Should start with "postgresql://"'
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_URL',
    test: (val) => val.includes('.supabase.co'),
    message: 'Should contain ".supabase.co"'
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    test: (val) => val.startsWith('eyJ'),
    message: 'Should start with "eyJ" (JWT format)'
  }
];

let hasValidationErrors = false;

validations.forEach(({ name, test, message }) => {
  const value = process.env[name];
  if (!test(value)) {
    console.log(`❌ ${name}: ${message}`);
    hasValidationErrors = true;
  } else {
    console.log(`✅ ${name}: Format looks good`);
  }
});

if (hasValidationErrors) {
  console.log('\n💡 Please check your environment variables and try again\n');
  process.exit(1);
}

// Check Node.js version
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

if (majorVersion < 18) {
  console.log(`⚠️ Node.js ${nodeVersion} detected. Node.js 18+ is recommended`);
} else {
  console.log(`✅ Node.js ${nodeVersion} - Compatible`);
}

// Check if node_modules exists
if (!fs.existsSync(path.join(process.cwd(), 'node_modules'))) {
  console.log('❌ node_modules not found');
  console.log('💡 Run: npm install');
  process.exit(1);
}

console.log('✅ Dependencies installed');

console.log('\n🎉 Development environment setup complete!');
console.log('\n📋 Next steps:');
console.log('   1. Start the development server: npm run dev');
console.log('   2. Open http://localhost:12000 in your browser');
console.log('   3. Check the console for any additional setup messages');
console.log('\n🦆 Happy coding with The Duck!'); 