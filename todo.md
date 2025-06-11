# Project Todo List

This document outlines the development priorities for The Duck, focusing on critical fixes, refactoring, and feature implementation.

## ✅ P0: Critical Security & Architecture Refactor - **COMPLETED**

**Goal**: Eliminate the critical security vulnerability caused by direct client-side database access and establish a secure client-server architecture. **This is the highest priority.**

-   [x] **Refactor Database Access to Server-Side APIs (CRITICAL)** ✅ COMPLETED
    -   [x] Create a new `/api/sessions` API route for all chat session CRUD operations.
        -   [x] `GET /api/sessions`: Fetch all chat sessions for the authenticated user.
        -   [x] `POST /api/sessions`: Create a new chat session.
        -   [x] `GET /api/sessions/[sessionId]`: Fetch a single chat session.
        -   [x] `PUT /api/sessions/[sessionId]`: Update a chat session (e.g., title, messages).
        -   [x] `DELETE /api/sessions/[sessionId]`: Delete a chat session.
    -   [x] Create a new `/api/user/preferences` API route for user settings.
        -   [x] `GET /api/user/preferences`: Fetch user preferences.
        -   [x] `PUT /api/user/preferences`: Update user preferences.
        -   [x] `POST /api/user/preferences`: Handle special actions (toggleStarred, setPrimary).
    -   [x] Move all database logic from `src/lib/db/supabase-operations.ts` into these new API routes.
    -   [x] Refactor `src/lib/chat-service.ts` to use `fetch` to call these new endpoints instead of `DatabaseService`.
    -   [x] Delete `src/lib/db/supabase-operations.ts` and `src/lib/db/operations.ts` once the refactor is complete.

-   [x] **Remove Insecure API Routes** ✅ COMPLETED
    -   [x] Delete the following directories from `src/app/api`:
        -   `database-test` ✅ Deleted
        -   `security-test` ✅ Deleted
        -   `auth-test` ✅ Deleted
        -   `test-auth` ✅ Deleted
        -   `debug` ✅ Deleted
        -   `fix-schema` ✅ Deleted
        -   `test-chat-save` ✅ Deleted
    -   [x] Review `middleware.ts` to remove logic that blocks these now-deleted routes.

-   [x] **Cleanup Dependencies** ✅ COMPLETED
    -   [x] Remove the unused `next-auth` package: `npm uninstall next-auth`.

**✅ P0 STATUS: COMPLETE** - All critical security vulnerabilities have been eliminated. The application now uses secure server-side API architecture with proper authentication boundaries.

## 🔧 Development Infrastructure - **COMPLETED**

-   [x] **Automated Development Workflow** ✅ COMPLETED
    -   [x] Add pre-commit git hooks for automated quality checks (build + lint + type-check)
    -   [x] Add npm scripts for workflow automation (`npm run workflow`)
    -   [x] Update CLAUDE.md with comprehensive development instructions
    -   [x] Fix Next.js 15 compatibility issues (async params in API routes)
    -   [x] Create comprehensive CLAUDE.md development guide

-   [x] **Code Quality Improvements** ✅ COMPLETED
    -   [x] Reduce linting errors by 45% (from 80+ to 44 remaining)
    -   [x] Add proper TypeScript interfaces for better type safety
    -   [x] Remove unused imports and variables
    -   [x] Fix explicit `any` types with proper interfaces

## 🎯 P1: Code Quality & Refactoring - **IN PROGRESS**

**Goal**: Improve the maintainability, readability, and stability of the codebase.

-   [ ] **Complete Linting Cleanup** 🔄 IN PROGRESS
    -   [x] Fix major TypeScript errors and unused variables (44 errors remaining)
    -   [ ] Address remaining `any` types with proper interfaces
    -   [ ] Fix React Hook dependency warnings
    -   [ ] Clean up unused imports in components

-   [ ] **Refactor `ChatInterface.tsx` Component**
    -   [ ] Break down the component's logic into smaller, focused custom hooks (e.g., `useChatSession`, `useMessageHandling`).
    -   [ ] Simplify the `useEffect` hooks to reduce complexity and prevent unexpected side effects.
    -   [ ] Isolate state management to make the component's behavior easier to reason about.

-   [ ] **Centralize Configuration**
    -   [ ] Remove the hardcoded `model` name in `ChatInterface.tsx`.
    -   [ ] The default model should be part of the user preferences fetched from the new `/api/user/preferences` endpoint.

-   [ ] **Improve Error Handling**
    -   [ ] Implement more robust error handling in API routes and on the client-side.
    -   [ ] Display user-friendly error messages using toasts for failed operations (e.g., "Failed to save chat").

## 🎯 P2: Feature Implementation

**Goal**: Build out planned features on top of the new, secure architecture.

-   [x] **Implement User Preferences Persistence** ✅ COMPLETED
    -   [x] Create the `user_preferences` table in the database.
    -   [x] Use the new `/api/user/preferences` route to save and load settings like theme, primary model, and response tone.
    -   [x] Ensure settings are synced across sessions and devices.

-   [ ] **Implement File Uploads**
    -   [ ] Configure a Supabase Storage bucket for file uploads.
    -   [ ] Create a new API route (`/api/files`) to handle generating signed upload URLs.
    -   [ ] Build the client-side UI for file drag-and-drop and upload progress.
    -   [ ] Associate uploaded files with specific chat sessions.

-   [ ] **Enhance "Memory Mode"**
    -   [ ] Use the stored chat summaries to provide context to new conversations.
    -   [ ] Implement a mechanism to inject relevant memories or topics into the model's prompt.

## 🎯 P3: Quality of Life & Polish

**Goal**: Enhance the user experience with smaller improvements.

-   [ ] **Add Full-Text Search for Chat History**
    -   [ ] Implement a database function for searching across all of a user's messages.
    -   [ ] Create a new API route to expose this search functionality.
    -   [ ] Integrate the search into the `ChatHistorySidebar`.

-   [ ] **Improve UI/UX**
    -   [ ] Add loading skeletons for a smoother initial page load.
    -   [ ] Refine the UI for settings management.
    -   [ ] Add a confirmation dialog before deleting a chat session.

## 📊 Current Project Status

### ✅ **COMPLETED (Major Milestones)**
- **Critical Security Refactor**: Eliminated P0 security vulnerabilities
- **Secure API Architecture**: All database operations now use authenticated server-side APIs
- **Development Infrastructure**: Automated workflow with build/lint/type-check validation
- **User Preferences System**: Complete user settings persistence and management

### 🔄 **IN PROGRESS**
- **Code Quality**: Continuing lint error cleanup (44 remaining from 80+)
- **Type Safety**: Improving TypeScript interfaces throughout codebase

### 🎯 **NEXT PRIORITIES**
1. **Complete P1 Code Quality tasks** (linting, refactoring ChatInterface.tsx)
2. **Implement File Uploads** (P2 feature)
3. **Enhance Memory Mode** with chat summaries

### 🏗️ **Current Architecture Status**
- ✅ **Secure**: No client-side database access
- ✅ **Authenticated**: All API routes verify user sessions
- ✅ **Type-Safe**: Proper TypeScript interfaces
- ✅ **Validated**: Automated build/lint/type-check pipeline
- ✅ **Production-Ready**: Successful build verification