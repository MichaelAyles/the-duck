# Project Todo List

This document outlines the development priorities for The Duck, focusing on critical fixes, refactoring, and feature implementation.

## 🎯 P0: Critical Security & Architecture Refactor

**Goal**: Eliminate the critical security vulnerability caused by direct client-side database access and establish a secure client-server architecture. **This is the highest priority.**

-   [ ] **Refactor Database Access to Server-Side APIs (CRITICAL)**
    -   [ ] Create a new `/api/sessions` API route for all chat session CRUD operations.
        -   [ ] `GET /api/sessions`: Fetch all chat sessions for the authenticated user.
        -   [ ] `POST /api/sessions`: Create a new chat session.
        -   [ ] `GET /api/sessions/[sessionId]`: Fetch a single chat session.
        -   [ ] `PUT /api/sessions/[sessionId]`: Update a chat session (e.g., title, messages).
        -   [ ] `DELETE /api/sessions/[sessionId]`: Delete a chat session.
    -   [ ] Create a new `/api/user/preferences` API route for user settings.
        -   [ ] `GET /api/user/preferences`: Fetch user preferences.
        -   [ ] `PUT /api/user/preferences`: Update user preferences.
    -   [ ] Move all database logic from `src/lib/db/supabase-operations.ts` into these new API routes.
    -   [ ] Refactor `src/lib/chat-service.ts` to use `fetch` to call these new endpoints instead of `DatabaseService`.
    -   [ ] Delete `src/lib/db/supabase-operations.ts` and `src/lib/db/operations.ts` once the refactor is complete.

-   [ ] **Remove Insecure API Routes**
    -   [ ] Delete the following directories from `src/app/api`:
        -   `database-test`
        -   `security-test`
        -   `auth-test`
        -   `test-auth`
        -   `debug`
        -   `fix-schema`
        -   `test-chat-save`
    -   [ ] Review `middleware.ts` to remove logic that blocks these now-deleted routes.

-   [ ] **Cleanup Dependencies**
    -   [ ] Remove the unused `next-auth` package: `npm uninstall next-auth`.

## 🎯 P1: Code Quality & Refactoring

**Goal**: Improve the maintainability, readability, and stability of the codebase.

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

-   [ ] **Implement User Preferences Persistence**
    -   [ ] Create the `user_preferences` table in the database.
    -   [ ] Use the new `/api/user/preferences` route to save and load settings like theme, primary model, and response tone.
    -   [ ] Ensure settings are synced across sessions and devices.

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
