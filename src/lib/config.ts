/**
 * 🔧 Application Configuration
 * 
 * Centralized configuration constants and default values
 */

// Default AI model settings
export const DEFAULT_AI_MODEL = "google/gemini-2.5-flash-preview-05-20";

// Centralized default active models (5 curated models)
export const DEFAULT_ACTIVE_MODELS: string[] = [
  'google/gemini-2.5-flash-preview-05-20',
  'google/gemini-2.5-pro-preview-05-06', 
  'deepseek/deepseek-chat-v3-0324',
  'anthropic/claude-sonnet-4',
  'openai/gpt-4o-mini'
];

// Default chat settings
export const DEFAULT_CHAT_SETTINGS = {
  tone: "match-user" as const,
  storageEnabled: true,
  model: DEFAULT_AI_MODEL,
  memoryEnabled: false,
  memorySummaryCount: 3,
};

// Chat configuration
export const CHAT_CONFIG = {
  // Maximum messages to send for title generation
  TITLE_GENERATION_MESSAGE_LIMIT: 6,
  
  // Number of user messages required before generating title
  TITLE_GENERATION_TRIGGER_COUNT: 2,
  
  // Welcome message content
  WELCOME_MESSAGE: "🦆 How can I help you?",
  
  // Inactivity timeout (in minutes)
  INACTIVITY_TIMEOUT_MINUTES: 30,
} as const;

// API endpoints
export const API_ENDPOINTS = {
  CHAT: "/api/chat",
  MODELS: "/api/models",
  GENERATE_TITLE: "/api/generate-title",
  USER_PREFERENCES: "/api/user/preferences",
  SESSIONS: "/api/sessions",
} as const;

// Model provider configurations
export const MODEL_PROVIDERS = {
  GOOGLE: "google",
  OPENAI: "openai", 
  ANTHROPIC: "anthropic",
  DEEPSEEK: "deepseek",
} as const;

// Response tone options
export const RESPONSE_TONES = {
  MATCH_USER: "match-user",
  FRIENDLY: "friendly",
  PROFESSIONAL: "professional", 
  CASUAL: "casual",
  ACADEMIC: "academic",
} as const;

export type ResponseTone = typeof RESPONSE_TONES[keyof typeof RESPONSE_TONES];

// Performance thresholds
export const PERFORMANCE_THRESHOLDS = {
  API_TIMEOUT: 30000, // 30 seconds
  STREAM_TIMEOUT: 120000, // 2 minutes
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // 1 second
  MAX_MESSAGE_LENGTH: 10000, // characters
} as const;

// File upload settings
export const FILE_UPLOAD = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_TOTAL_STORAGE: 1024 * 1024 * 1024, // 1GB per user
  ALLOWED_MIME_TYPES: [
    // Images
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    // Documents
    'application/pdf', 
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    // Text
    'text/plain', 'text/csv', 'text/markdown',
    // Code
    'text/javascript', 'application/json', 'text/html', 'text/css',
    // Archives
    'application/zip', 'application/x-tar', 'application/x-gzip',
  ],
  COST_PER_UPLOAD: 0.001, // $0.001 per file upload
} as const;