import { pgTable, text, timestamp, jsonb, boolean } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

/**
 * 🦆 The Duck - Database Schema
 * 
 * Simplified schema aligned with current Supabase implementation
 * for chat persistence and summarization functionality.
 */

// Chat sessions table - matches current Supabase structure
export const chatSessions = pgTable('chat_sessions', {
  id: text('id').primaryKey(), // Using text ID to match current nanoid usage
  title: text('title').notNull(),
  messages: jsonb('messages').notNull(), // Store all messages as JSONB
  model: text('model').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  isActive: boolean('is_active').default(true),
});

// Chat summaries table - matches current Supabase structure  
export const chatSummaries = pgTable('chat_summaries', {
  id: text('id').primaryKey(), // Using text ID to match current nanoid usage
  sessionId: text('session_id').references(() => chatSessions.id, { onDelete: 'cascade' }).notNull(),
  summary: text('summary').notNull(),
  keyTopics: text('key_topics').array().notNull().default([]), // PostgreSQL array type
  userPreferences: jsonb('user_preferences').notNull().default({}),
  writingStyleAnalysis: jsonb('writing_style_analysis').notNull().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations for type safety
export const chatSessionsRelations = relations(chatSessions, ({ one }) => ({
  summary: one(chatSummaries, {
    fields: [chatSessions.id],
    references: [chatSummaries.sessionId],
  }),
}));

export const chatSummariesRelations = relations(chatSummaries, ({ one }) => ({
  session: one(chatSessions, {
    fields: [chatSummaries.sessionId],
    references: [chatSessions.id],
  }),
}));

// Type exports for use in application
export type ChatSession = typeof chatSessions.$inferSelect;
export type NewChatSession = typeof chatSessions.$inferInsert;
export type ChatSummary = typeof chatSummaries.$inferSelect;
export type NewChatSummary = typeof chatSummaries.$inferInsert;