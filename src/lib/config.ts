/**
 * 🔧 Application Configuration
 * 
 * Centralized configuration constants and default values
 */

// Default AI model settings
export const DEFAULT_AI_MODEL = "google/gemini-2.5-flash-preview-05-20";

// Default chat settings
export const DEFAULT_CHAT_SETTINGS = {
  tone: "match-user" as const,
  storageEnabled: true,
  model: DEFAULT_AI_MODEL,
};

// Chat configuration
export const CHAT_CONFIG = {
  // Maximum messages to send for title generation
  TITLE_GENERATION_MESSAGE_LIMIT: 6,
  
  // Number of user messages required before generating title
  TITLE_GENERATION_TRIGGER_COUNT: 2,
  
  // Welcome message content
  WELCOME_MESSAGE: "🦆 Hello! I'm The Duck, your friendly AI assistant. Ready to dive into some quack-tastic conversations? Whether you need help with questions, creative projects, or just want to chat, I'm here to make waves! What can I help you with today?",
  
  // Inactivity timeout (in minutes)
  INACTIVITY_TIMEOUT_MINUTES: 30,
} as const;

// API endpoints
export const API_ENDPOINTS = {
  CHAT: "/api/chat",
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