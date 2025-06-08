import { pgTable, text, timestamp, uuid, jsonb, boolean, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').unique().notNull(),
  name: text('name'),
  image: text('image'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// User preferences table
export const userPreferences = pgTable('user_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  
  // Model preferences
  favoriteModels: jsonb('favorite_models').$type<string[]>().default([]),
  defaultModel: text('default_model'),
  
  // UI preferences
  theme: text('theme').default('system'), // 'light', 'dark', 'system'
  storageEnabled: boolean('storage_enabled').default(true),
  
  // Domain-specific preferences
  domainPreferences: jsonb('domain_preferences').$type<{
    likes: string[];
    dislikes: string[];
    notes: string;
  }>().default({ likes: [], dislikes: [], notes: '' }),
  
  // Writing style analysis
  writingStyle: jsonb('writing_style').$type<{
    verbosity: 'concise' | 'moderate' | 'detailed';
    formality: 'casual' | 'professional' | 'academic';
    technicalLevel: 'beginner' | 'intermediate' | 'expert';
    preferredTone: string;
    responseLength: 'short' | 'medium' | 'long';
    useJargon: boolean;
  }>().default({
    verbosity: 'moderate',
    formality: 'casual',
    technicalLevel: 'intermediate',
    preferredTone: 'helpful',
    responseLength: 'medium',
    useJargon: false,
  }),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Chat sessions table
export const chatSessions = pgTable('chat_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  title: text('title'),
  model: text('model').notNull(),
  isActive: boolean('is_active').default(true),
  endedAt: timestamp('ended_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Messages table
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => chatSessions.id, { onDelete: 'cascade' }).notNull(),
  role: text('role').notNull(), // 'user' | 'assistant' | 'system'
  content: text('content').notNull(),
  metadata: jsonb('metadata').$type<{
    model?: string;
    tokens?: number;
    cost?: number;
    processingTime?: number;
  }>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Chat summaries table
export const chatSummaries = pgTable('chat_summaries', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => chatSessions.id, { onDelete: 'cascade' }).notNull().unique(),
  summary: text('summary').notNull(),
  keyTopics: jsonb('key_topics').$type<string[]>().default([]),
  userInsights: jsonb('user_insights').$type<{
    detectedPreferences: string[];
    writingStyleNotes: string;
    technicalLevel: string;
    domainInterests: string[];
  }>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Available models table (for caching OpenRouter/Ollama models)
export const availableModels = pgTable('available_models', {
  id: text('id').primaryKey(), // model ID from provider
  name: text('name').notNull(),
  provider: text('provider').notNull(), // 'openrouter' | 'ollama'
  description: text('description'),
  contextLength: integer('context_length'),
  pricing: jsonb('pricing').$type<{
    prompt?: number;
    completion?: number;
    currency?: string;
  }>(),
  isActive: boolean('is_active').default(true),
  lastUpdated: timestamp('last_updated').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  preferences: one(userPreferences),
  chatSessions: many(chatSessions),
}));

export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({
  user: one(users, {
    fields: [userPreferences.userId],
    references: [users.id],
  }),
}));

export const chatSessionsRelations = relations(chatSessions, ({ one, many }) => ({
  user: one(users, {
    fields: [chatSessions.userId],
    references: [users.id],
  }),
  messages: many(messages),
  summary: one(chatSummaries),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  session: one(chatSessions, {
    fields: [messages.sessionId],
    references: [chatSessions.id],
  }),
}));

export const chatSummariesRelations = relations(chatSummaries, ({ one }) => ({
  session: one(chatSessions, {
    fields: [chatSummaries.sessionId],
    references: [chatSessions.id],
  }),
}));