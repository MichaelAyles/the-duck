#!/usr/bin/env node

/**
 * 🦆 The Duck - Development Setup Script
 * 
 * Interactive setup and validation for The Duck development environment
 * Helps developers get up and running quickly with proper configuration
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ANSI color codes for pretty output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logHeader(message) {
  log(`\n🦆 ${message}`, 'cyan');
  log('='.repeat(50), 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

// Required environment variables
const requiredEnvVars = [
  {
    name: 'OPENROUTER_API_KEY',
    description: 'OpenRouter API key for AI model access',
    example: 'sk-or-v1-...',
    required: true,
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_URL',
    description: 'Supabase project URL',
    example: 'https://your-project.supabase.co',
    required: true,
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    description: 'Supabase anonymous key',
    example: 'eyJhbGciOi...',
    required: true,
  },
  {
    name: 'NEXT_PUBLIC_APP_URL',
    description: 'Your app URL (for OAuth redirects)',
    example: 'https://your-domain.com',
    required: false,
  },
];

async function checkEnvironment() {
  logHeader('Environment Check');
  
  const envPath = path.join(process.cwd(), '.env.local');
  const examplePath = path.join(process.cwd(), '.env.example');
  
  // Check if .env.local exists
  if (!fs.existsSync(envPath)) {
    logWarning('.env.local file not found');
    
    if (fs.existsSync(examplePath)) {
      logInfo('Found .env.example file');
      const shouldCopy = await askQuestion('Would you like to copy .env.example to .env.local? (y/n): ');
      
      if (shouldCopy.toLowerCase() === 'y' || shouldCopy.toLowerCase() === 'yes') {
        fs.copyFileSync(examplePath, envPath);
        logSuccess('Copied .env.example to .env.local');
      }
    } else {
      logInfo('Creating new .env.local file');
      fs.writeFileSync(envPath, '# The Duck Environment Configuration\n\n');
    }
  }
  
  // Load current environment
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envLines = envContent.split('\n');
  const currentEnv = {};
  
  envLines.forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      currentEnv[match[1].trim()] = match[2].trim();
    }
  });
  
  // Check each required variable
  const missing = [];
  const warnings = [];
  
  for (const envVar of requiredEnvVars) {
    const value = process.env[envVar.name] || currentEnv[envVar.name];
    
    if (!value) {
      if (envVar.required) {
        missing.push(envVar);
        logError(`Missing required: ${envVar.name}`);
      } else {
        warnings.push(envVar);
        logWarning(`Missing optional: ${envVar.name}`);
      }
    } else {
      logSuccess(`Found: ${envVar.name}`);
      
      // Validate format
      if (envVar.name === 'OPENROUTER_API_KEY' && !value.startsWith('sk-or-')) {
        logWarning(`${envVar.name} format may be incorrect (should start with sk-or-)`);
      }
      
      if (envVar.name === 'NEXT_PUBLIC_SUPABASE_URL' && !value.includes('supabase.co')) {
        logWarning(`${envVar.name} format may be incorrect (should contain supabase.co)`);
      }
    }
  }
  
  if (missing.length > 0) {
    logError(`\nMissing ${missing.length} required environment variable(s)`);
    const shouldSetup = await askQuestion('Would you like to set them up now? (y/n): ');
    
    if (shouldSetup.toLowerCase() === 'y' || shouldSetup.toLowerCase() === 'yes') {
      await setupEnvironmentVariables(missing, envPath);
    }
  }
  
  if (warnings.length > 0) {
    logWarning(`\n${warnings.length} optional environment variable(s) not set`);
    logInfo('These are optional but recommended for full functionality');
  }
  
  if (missing.length === 0) {
    logSuccess('\n✨ All required environment variables are configured!');
  }
}

async function setupEnvironmentVariables(missing, envPath) {
  logHeader('Environment Setup');
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  let newContent = envContent;
  
  for (const envVar of missing) {
    log(`\n📝 Setting up: ${envVar.name}`, 'bright');
    log(`Description: ${envVar.description}`);
    log(`Example: ${envVar.example}`);
    
    const value = await askQuestion(`Enter value for ${envVar.name}: `);
    
    if (value.trim()) {
      // Add or update the environment variable
      const regex = new RegExp(`^${envVar.name}=.*$`, 'm');
      if (regex.test(newContent)) {
        newContent = newContent.replace(regex, `${envVar.name}=${value.trim()}`);
      } else {
        newContent += `\n${envVar.name}=${value.trim()}`;
      }
      
      logSuccess(`Set ${envVar.name}`);
    } else {
      logWarning(`Skipped ${envVar.name}`);
    }
  }
  
  // Write updated content
  fs.writeFileSync(envPath, newContent);
  logSuccess('Environment file updated!');
}

async function checkDependencies() {
  logHeader('Dependencies Check');
  
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    logError('package.json not found');
    return;
  }
  
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  const requiredDeps = [
    '@supabase/supabase-js',
    'next',
    'react',
    'typescript',
  ];
  
  let allPresent = true;
  
  for (const dep of requiredDeps) {
    if (dependencies[dep]) {
      logSuccess(`Found: ${dep}@${dependencies[dep]}`);
    } else {
      logError(`Missing: ${dep}`);
      allPresent = false;
    }
  }
  
  if (!allPresent) {
    logWarning('Some dependencies are missing. Run: npm install');
  } else {
    logSuccess('All required dependencies are installed!');
  }
}

async function checkSupabaseSetup() {
  logHeader('Supabase Setup Check');
  
  // Load environment variables from .env.local
  const envPath = path.join(process.cwd(), '.env.local');
  let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  // If not in process.env, try to read from .env.local
  if ((!supabaseUrl || !supabaseKey) && fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envLines = envContent.split('\n');
    
    envLines.forEach(line => {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/['"]/g, ''); // Remove quotes
        if (key === 'NEXT_PUBLIC_SUPABASE_URL') supabaseUrl = value;
        if (key === 'NEXT_PUBLIC_SUPABASE_ANON_KEY') supabaseKey = value;
      }
    });
  }
  
  if (!supabaseUrl || !supabaseKey) {
    logWarning('Supabase environment variables not configured');
    logInfo('Please set up your Supabase project and add the credentials to .env.local');
    return;
  }
  
  try {
    // Test Supabase connection
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Try a simple query
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('id')
      .limit(1);
    
    if (error) {
      logWarning(`Supabase connection issue: ${error.message}`);
      logInfo('Make sure your database tables are created and RLS policies are set up');
    } else {
      logSuccess('Supabase connection successful!');
    }
  } catch (error) {
    logError(`Supabase test failed: ${error.message}`);
  }
}

async function runSetup() {
  log('🦆 Welcome to The Duck Development Setup!', 'bright');
  log('This script will help you configure your development environment.\n');
  
  try {
    await checkEnvironment();
    await checkDependencies();
    await checkSupabaseSetup();
    
    logHeader('Setup Complete');
    logSuccess('Your development environment is ready!');
    logInfo('Run "npm run dev" to start the development server');
    
  } catch (error) {
    logError(`Setup failed: ${error.message}`);
    process.exit(1);
  } finally {
    rl.close();
  }
}

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

// Run the setup
if (require.main === module) {
  runSetup();
} 