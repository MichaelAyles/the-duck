# 🚨 COMPREHENSIVE CODE REVIEW & CRITICAL FIXES NEEDED

## ⚠️ IMMEDIATE CRITICAL ISSUES IDENTIFIED

**COMPREHENSIVE ANALYSIS COMPLETED**: Full codebase review reveals multiple performance, reliability, and UX issues requiring immediate attention.

**PRIORITY**: Focus on reliability, performance, and user experience before adding new features.

## 🔴 CRITICAL DATABASE MIGRATIONS - **COMPLETED**

**Issues Resolved**: 
1. ✅ Missing `chat_summaries` table - FIXED
2. ✅ Append-only message storage architecture - IMPLEMENTED  
3. ✅ PostgreSQL column ambiguity and constraint violations - RESOLVED

**Recent Migrations Applied**:
- ✅ `/sql/create_chat_summaries_table.sql` - Chat summaries table with RLS
- ✅ `/sql/append-only-messages-migration.sql` - Append-only architecture for data integrity
- ✅ `/sql/test-append-only-messages.sql` - Migration verification and testing

**Database Architecture Status**: ✅ PRODUCTION READY
- Append-only message storage prevents data loss
- Comprehensive foreign key constraints and validation
- Row-Level Security (RLS) policies for all tables  
- Robust error handling and retry logic

---

## 📊 CODE REVIEW FINDINGS

### 🔴 CRITICAL PERFORMANCE ISSUES
1. **Excessive Re-renders**: ChatMessages component logging on every render
2. **Multiple API Calls**: Repeated calls to same endpoints (starred-models, user preferences, sessions)
3. **Slow API Responses**: 2+ second response times for chat-history, starred-models
4. **Session Recreation**: Multiple "Session ID changing" logs indicating unstable session management
5. **Welcome Message Duplication**: Multiple "Adding welcome message" logs

### 🟠 RELIABILITY ISSUES  
1. **Complex Hook Dependencies**: 440-line use-message-handling.ts with circular dependencies
2. **Race Conditions**: Complex logic to prevent duplicate session loads
3. **State Synchronization**: Multiple sources of truth for session state
4. **Error Handling**: Inconsistent error handling across components
5. **Memory Leaks**: Potential cleanup issues in streaming and timers

### 🟡 USER EXPERIENCE ISSUES
1. **Image Warnings**: Next.js aspect ratio warnings for duck logos
2. **Loading States**: Some endpoints slow without proper loading indicators
3. **Fast Refresh**: Multiple rebuilds during development
4. **Compilation Times**: 2.5s initial compilation, affecting dev experience

### 🔵 CODE QUALITY ISSUES
1. **File Complexity**: Several files >200 lines with multiple responsibilities
2. **Tight Coupling**: Components tightly coupled to specific hooks
3. **Console Logging**: Excessive debug logging in production code
4. **Type Safety**: Some areas could benefit from stricter typing

## 🚨 CRITICAL USABILITY ISSUES (PRIORITY ORDER)

### 1. **Authentication Flow Race Condition** ⚠️ CRITICAL
- **Problem**: 1-second timeout races with `getSession()` causing random logouts
- **Location**: `auth-provider.tsx:24-32` - Timeout vs getSession() race
- **Impact**: Users randomly logged out, authentication state flickers, protected routes fail
- **Fix**: Remove 1-second timeout, use proper loading states based on actual auth response

### 2. **Race Condition Chaos** ⚠️ CRITICAL  
- **Problem**: Multiple competing state updates create infinite render loops
- **Location**: `use-chat-session.ts:168-187` - Welcome message logic, session ID recreation
- **Impact**: App becomes unresponsive, infinite loading states, duplicate messages
- **Fix**: Stabilize sessionId with useRef, remove circular dependencies, fix welcome message ping-pong

### 3. **Session Loading Hell** ⚠️ CRITICAL
- **Problem**: Cascade of cache misses creates 4+ second load times
- **Location**: Flow diagram lines 88-112 - Multi-tier cache resolution
- **Impact**: Slow initial loads, blank screens, no loading progress feedback
- **Fix**: Add loading indicators, optimize cache strategy, preload critical data

### 4. **Message Send Delays** ⚠️ CRITICAL
- **Problem**: Artificial delays pile up during message sending
- **Location**: `use-message-handling.ts:195-198` - Sequential setTimeout calls
- **Impact**: Sluggish chat responses (800ms thinking + 100ms artifact + 100ms save)
- **Fix**: Remove artificial delays, implement proper streaming progress indicators

### 5. **Model Selection Nightmare** ⚠️ HIGH
- **Problem**: Every dropdown interaction triggers API calls
- **Location**: `use-starred-models.ts:64-65` - handleModelDropdownOpen
- **Impact**: 2+ second delays when opening model selector, excessive API calls
- **Fix**: Cache model catalog properly, preload curated models on app start

### 6. **Radix UI Component Crashes** ⚠️ HIGH
- **Problem**: Complex Select components with unstable dependencies
- **Location**: `chat-header.tsx:222-305` - Select component infinite loops
- **Impact**: UI freezes, dropdowns don't open, component crashes
- **Fix**: Decompose complex components, stabilize dependencies, optimize Select usage

### 7. **Settings Persistence Chaos** ⚠️ HIGH
- **Problem**: Optimistic updates with poor rollback
- **Location**: Flow lines 257-271 - Local storage vs Redis invalidation race
- **Impact**: Settings appear saved but revert unexpectedly, data loss
- **Fix**: Implement proper rollback logic, handle API failures gracefully

### 8. **File Upload Confusion** ⚠️ MEDIUM
- **Problem**: Broken file attachment flow
- **Location**: `chat-input.tsx:545-575` - sessionId ignored, empty storage_path
- **Impact**: Files appear attached but aren't uploaded, lost attachments
- **Fix**: Fix sessionId usage, implement proper upload flow with status feedback

### 9. **Error State Limbo** ⚠️ MEDIUM
- **Problem**: Poor error recovery patterns throughout codebase
- **Location**: Multiple components - Generic error messages, no retry options
- **Impact**: App feels broken, users forced to refresh page
- **Fix**: Add retry buttons, specific error messages, graceful degradation

### 10. **Mobile UX Disaster** ⚠️ MEDIUM
- **Problem**: Complex conditional rendering modes
- **Location**: `chat-interface.tsx:30-44` - renderHeaderOnly/BodyOnly/InputOnly
- **Impact**: Poor mobile experience, components don't render correctly
- **Fix**: Simplify rendering logic, implement proper responsive design

## 🎯 IMMEDIATE ACTION PLAN

### Phase 1: Critical Performance Fixes (2-4 hours)

#### 1. **Remove Excessive Debug Logging** ⚠️ CRITICAL
- **Problem**: ChatMessages component logs on every render causing performance issues
- **Location**: `chat-messages.tsx:30` - Debug logging in render cycle
- **Fix**: Remove/conditionally enable debug logs

#### 2. **Fix Image Aspect Ratio Warnings** ⚠️ CRITICAL  
- **Problem**: Next.js warnings about duck logo aspect ratios
- **Location**: `duck-logo.tsx:27` - Missing width/height auto styles
- **Fix**: Add proper CSS for aspect ratio maintenance

#### 3. **Optimize API Call Patterns** ⚠️ CRITICAL
- **Problem**: Multiple repeated calls to same endpoints
- **Location**: Multiple hooks calling starred-models, user preferences repeatedly
- **Fix**: Implement proper caching and request deduplication

#### 4. **Stabilize Session Management** ⚠️ CRITICAL
- **Problem**: Session ID recreation causing state instability
- **Location**: `use-chat-session.ts` - Complex session initialization logic
- **Fix**: Simplify session creation and prevent unnecessary recreation
- **Impact**: Infinite re-renders as callbacks recreate on every render

### 2. **Multiple State Update Loops** ⚠️ CRITICAL  
- **Problem**: Welcome message logic creates competing state updates
- **Location**: `use-chat-session.ts:172-187` - Welcome message effect triggers when messages.length changes
- **Impact**: State ping-pong between empty array and welcome message

### 3. **Radix UI Ref Composition Issues** ⚠️ CRITICAL
- **Problem**: Error stack shows `@radix-ui/react-compose-refs` infinite loops
- **Location**: Likely in `chat-header.tsx` Select components (lines 222-305)
- **Impact**: UI component ref handling causing state cascades

## File-Level Critical Issues

### `use-chat-session.ts` - HIGHEST PRIORITY
**Issues:**
1.  **Line 168**: `loadSessionMessages` in dependency array creates circular calls.
2.  **Line 187**: Welcome message effect depends on `messages.length` causing loops.
3.  **Line 153**: Main effect includes `sessionId` which changes during initialization.
4.  **Line 134**: `crypto.randomUUID()` called in effect creates new IDs on every render.

**Race Conditions:**
- Session ID initialization vs message loading
- Welcome message insertion vs message clearing
- Chat service creation vs session loading

**Detailed Recommendations for `use-chat-session.ts`:**
1.  **Refactor Session ID Management**:
    *   **Problem**: `sessionId` state is updated in multiple places, leading to potential race conditions and unnecessary re-renders. `crypto.randomUUID()` is called directly in an effect, which can cause new IDs to be generated on every render if not carefully managed.
    *   **Recommendation**:
        *   Introduce a `useRef` (e.g., `generatedSessionIdRef`) to store the initially generated session ID. This ensures the ID is stable across renders.
        *   Create a dedicated `useEffect` that runs only once (or when `initialSessionId` changes) to set the `sessionId` state based on `initialSessionId` or the `generatedSessionIdRef.current`.
        *   Ensure `createNewSession` also uses and updates this stable ID.
2.  **Optimize `loadSessionMessages` Callback**:
    *   **Problem**: `loadSessionMessages` is in the dependency array of an `useEffect` (around line 168 in the original file), which can lead to circular calls or unnecessary re-executions if `loadSessionMessages` itself is recreated.
    *   **Recommendation**:
        *   Remove `loadSessionMessages` from the dependency array of the `useEffect` that calls it.
        *   Ensure `loadSessionMessages` is memoized with `useCallback` and its own dependencies are stable. The current implementation already uses `useCallback`, but review its dependencies (`userId`, `welcomeMessage`, `toast`) to ensure they are stable.
        *   Consider using a `useRef` to store a stable reference to `loadSessionMessages` if it's still causing issues, though `useCallback` should generally suffice.
3.  **Refine Welcome Message Logic**:
    *   **Problem**: The welcome message logic (lines 172-187 in the original file) depends on `messages.length`, which can create a state ping-pong effect if `messages` is cleared and then the welcome message is added, causing `messages.length` to change again.
    *   **Recommendation**:
        *   Use a separate boolean state (e.g., `shouldShowWelcomeMessage`) to control when the welcome message should be displayed.
        *   Set `shouldShowWelcomeMessage` to `true` when `messages` is empty and a new session is initiated.
        *   Have a `useEffect` that triggers *only* when `shouldShowWelcomeMessage` is `true` to add the welcome message, and then immediately set `shouldShowWelcomeMessage` to `false`. This prevents re-triggering.
4.  **Improve `createNewSession` Stability**:
    *   **Problem**: `sessionId` is in the dependency array of `createNewSession`, which can cause the function to be recreated unnecessarily.
    *   **Recommendation**:
        *   Remove `sessionId` from the dependency array of `createNewSession`.
        *   If `createNewSession` needs the *current* `sessionId` for logging or other purposes, use a `useRef` to store the latest `sessionId` and access it via `latestSessionIdRef.current`.
5.  **Enhance Operation Locking**:
    *   **Problem**: The `isOperationInProgress` and `lockedSessionId` refs are good for preventing race conditions, but ensure their usage is consistent and covers all critical operations (e.g., message sending, session loading, session creation).
    *   **Recommendation**:
        *   Thoroughly audit all functions that modify session state or interact with the `ChatService` to ensure they respect the `isOperationInProgress` lock.
        *   Ensure `lockSession` and `unlockSession` are called reliably around all critical operations.
6.  **Review `chatServiceRef` Initialization**:
    *   **Problem**: The `chatServiceRef` is initialized within a `useEffect` that has `initialSessionId` and `userId` as dependencies. This might lead to `ChatService` being re-instantiated more often than necessary if these props change frequently.
    *   **Recommendation**:
        *   Ensure `chatServiceRef` is only re-initialized when the `sessionId` (the *actual* session ID, not just `initialSessionId`) or `userId` truly changes. The current check `chatServiceRef.current.getSessionId() !== currentSessionId` helps, but ensure the `useEffect` dependencies are minimal.
7.  **Logging**:
    *   **Problem**: Extensive `logger.dev.log` statements.
    *   **Recommendation**: While useful for development, ensure these are stripped or conditionally enabled for production builds to avoid performance overhead and exposing internal logic. (This is already noted in the general `todo.md` but worth reiterating for this critical file).

### `use-message-handling.ts` - HIGH PRIORITY
**Issues:**
1.  **Line 42-44**: Messages ref sync effect could cause loops with heavy message updates.
2.  **Line 422-432**: Massive dependency array with recreated objects.
3.  **Line 265-301**: Nested `setMessages` calls in async operations.
4.  **Line 314-381**: Complex streaming logic with state updates in loops.

**Detailed Recommendations for `use-message-handling.ts`:**
1.  **Simplify `handleSendMessage` Callback Dependencies**:
    *   **Problem**: The `handleSendMessage` `useCallback` has a very large dependency array (lines 422-432), including `settings`, `chatServiceRef`, `generateTitleIfNeeded`, `onTitleGenerated`, `setMessages`, `toast`, `lockSession`, `unlockSession`, and `processMessageForArtifacts`. Many of these are functions or objects that might be recreated on every render, leading to unnecessary re-creation of `handleSendMessage` itself.
    *   **Recommendation**:
        *   **Use `useRef` for stable function references**: For functions like `setMessages`, `toast`, `lockSession`, `unlockSession`, and `processMessageForArtifacts` that are passed down from parent hooks or contexts, consider wrapping them in `useRef` in the parent component/hook if they are not already stable. This allows `handleSendMessage` to access their current value without needing them in its dependency array.
        *   **Destructure `settings`**: Instead of passing the entire `settings` object, destructure only the properties truly needed within `handleSendMessage` (e.g., `settings.model`, `settings.storageEnabled`, `settings.tone`, `settings.memoryEnabled`, `settings.memorySummaryCount`). This reduces the chance of `settings` causing `handleSendMessage` to re-create if other unrelated `settings` properties change.
        *   **Memoize `generateTitleIfNeeded`**: Ensure `generateTitleIfNeeded` is properly memoized with `useCallback` and has a stable dependency array itself.
2.  **Refine Optimistic UI Updates and State Management**:
    *   **Problem**: The immediate `setMessages(newMessages)` and `setIsLoading(true)` are good for optimistic updates, but the subsequent asynchronous operations and nested `setMessages` calls within the streaming logic can lead to race conditions or stale state if not carefully managed.
    *   **Recommendation**:
        *   **Centralize `setMessages` updates**: Instead of multiple `setMessages` calls within the streaming loop and `setTimeout`s, consider a single, more controlled update mechanism. A `useReducer` could be beneficial here to manage the complex state transitions of messages (e.g., adding user message, adding thinking message, updating thinking message, appending streamed content, processing artifacts).
        *   **Avoid `setTimeout` for state updates**: The `setTimeout` calls for artifact processing and final session saving (lines 358 and 370) introduce arbitrary delays and can lead to race conditions where state updates happen out of order. These should be replaced with direct `await` calls or more robust state management patterns.
        *   **Ensure `messagesRef.current` consistency**: While `messagesRef.current = newMessages;` immediately updates the ref, ensure all subsequent logic within the `handleSendMessage`'s async IIFE consistently uses `messagesRef.current` for the most up-to-date message array, especially when making decisions or performing operations based on the message content.
3.  **Improve Streaming Logic Robustness**:
    *   **Problem**: The streaming logic involves complex buffer handling, JSON parsing, and conditional updates to the `messages` state. The `thinkingDuration` and `minimumThinkingTime` logic, while aiming for better UX, adds complexity and potential for subtle bugs if not perfectly synchronized.
    *   **Recommendation**:
        *   **Simplify `thinkingMessage` replacement**: Instead of `setTimeout` and `accumulatedContent`, consider a simpler approach. Once the first chunk arrives, immediately replace the `thinkingMessage` with the actual assistant message, and then append subsequent chunks. The `minimumThinkingTime` could be handled by simply delaying the *display* of the first chunk, rather than delaying the state update.
        *   **Centralized error handling for streaming**: Ensure all potential errors during streaming (network issues, JSON parsing errors, API errors) are caught and handled gracefully, leading to a consistent error message and state reset.
        *   **Clear `buffer` on `[DONE]`**: Ensure the `buffer` is completely cleared when `[DONE]` is received to prevent any leftover data from affecting subsequent messages.
4.  **Optimize `generateTitleIfNeeded`**:
    *   **Problem**: The `generateTitleIfNeeded` function filters messages multiple times (`filter` calls) and constructs a new array for the API call.
    *   **Recommendation**:
        *   **Combine filters**: Combine the `filter` conditions into a single pass to avoid multiple array iterations.
        *   **Memoize `generateTitleIfNeeded`**: Ensure this function is memoized with `useCallback` and its dependencies are stable to prevent unnecessary re-creations. (It is already `useCallback` but ensure its dependencies are stable).
5.  **Consistent Session Locking/Unlocking**:
    *   **Problem**: `lockSession` and `unlockSession` are called, but it's crucial that `unlockSession` is *always* called, even if errors occur during the `fetch` or streaming process.
    *   **Recommendation**:
        *   Ensure `unlockSession` is called in a `finally` block within the main `try...catch` of the `handleSendMessage`'s async IIFE to guarantee it's always executed, regardless of success or failure. (Currently, it's called in `finally` for the `reader` but also in the main `catch` block, which is good, but a single `finally` for the entire async operation would be more robust).
6.  **Logging**:
    *   **Problem**: Extensive `logger.dev.log` statements.
    *   **Recommendation**: As noted for `use-chat-session.ts`, ensure these are stripped or conditionally enabled for production builds.
7.  **Artifact Processing Timing**:
    *   **Problem**: The `setTimeout` for `processMessageForArtifacts` (line 358) introduces a delay and potential for race conditions.
    *   **Recommendation**:
        *   Integrate artifact processing directly into the message update flow, perhaps as part of the final `setMessages` call after streaming is complete, or by using a `useReducer` to manage message updates and artifact processing in a single, atomic step.

### `use-starred-models.ts` - HIGH PRIORITY
**Issues:**
1.  **Line 64-65**: `useEffect` with `loadStarredModels` dependency creates immediate calls.
2.  **Line 121, 170, 226**: Disabled exhaustive-deps warnings hide dependency issues.
3.  **Line 116, 165, 221**: Error recovery calls `loadStarredModels` creating loops.

**Detailed Recommendations for `use-starred-models.ts`:**
1.  **Refine `useEffect` for `loadStarredModels` (lines 84-91):**
    *   **Problem**: The `useEffect` that calls `loadStarredModels()` has `starredModels.length` as a dependency. While `isStale()` helps, if `starredModels` changes due to an optimistic update (e.g., `toggleStar`), this `useEffect` might trigger `loadStarredModels` unnecessarily, even if the data is not truly stale from the server's perspective. This could lead to excessive API calls if not managed carefully.
    *   **Recommendation**: Consider a more explicit trigger for `loadStarredModels` (e.g., a manual refresh button, or only on mount if `initialStarredModels` is empty). If the intention is to re-fetch when the *local* state of `starredModels` changes significantly (e.g., after a successful API call), ensure `loadStarredModels` is robust enough to handle rapid calls without causing issues (which `isLoadingRef` helps with). The `eslint-disable-line` comment should be removed if `loadStarredModels` is truly stable and its dependencies are correctly handled.
2.  **Improve `setActive` Error Reversion (lines 151-198):**
    *   **Problem**: On error, `setActive` doesn't explicitly revert the `activeModel` state. While the next successful load might correct it, it leaves the UI in a potentially incorrect state until then.
    *   **Recommendation**: Store the `activeModel` *before* the optimistic update. On error, explicitly revert `setActiveModelState` to this previous value. Example: `const previousActiveModel = activeModel; setActiveModelState(modelId); ... onError: setActiveModelState(previousModel);`
3.  **Conditional Logging (throughout):**
    *   **Problem**: `console.log` and `console.error` statements are present without `process.env.NODE_ENV === 'development'` checks.
    *   **Recommendation**: Wrap all `console.log` and `console.error` statements with `if (process.env.NODE_ENV === 'development')` to prevent them from appearing in production builds, as per `GEMINI.md` and general best practices.
4.  **Consistency in API Response Handling:**
    *   **Problem**: In `toggleStar` and `setActive`, there's a check `if (data.error) { throw new Error(...) }` even after `response.ok` is checked. This implies the API might return a 200 status with an error payload. While robust, it's worth ensuring this is the intended API behavior.
    *   **Recommendation**: Document this API behavior if it's intentional, or consider if the API should return non-200 status codes for errors. If the API *always* returns 200 on success, then the `response.ok` check is sufficient for network errors, and the `data.error` check handles application-level errors.
5.  **`isLoadingRef` vs `loading` state:**
    *   **Problem**: Both `isLoadingRef` and `loading` state are used to manage loading status. While `isLoadingRef` is good for preventing re-renders and race conditions within the `useCallback`, `loading` state is exposed to the component.
    *   **Recommendation**: Ensure their usage is consistent and clear. The current pattern seems to be `isLoadingRef` for internal logic and `loading` for UI state. This is generally acceptable, but worth noting for clarity.

### `use-models.ts` - MEDIUM PRIORITY
**Issues:**
1.  **Line 125-140**: Massive `useMemo` dependency array likely causing recreation.
2.  **Line 46-50, 90-94**: Model mapping with function calls in render cycles.
3.  **Line 60, 107**: Dependencies include functions that recreate.

**Detailed Recommendations for `use-models.ts`:**
1.  **Optimize `useMemo` Dependency Array (lines 125-140):**
    *   **Problem**: The `useMemo` hook for the return object has a very large dependency array, including `isStarred`, `isActive`, `toggleStar`, `setActive`, and `resetToDefaults`. These are functions from `useStarredModels`, and if `useStarredModels` recreates them unnecessarily, it will cause `useModels` to re-memoize its return object, potentially leading to unnecessary re-renders in consuming components.
    *   **Recommendation**: Ensure that the functions (`isStarred`, `isActive`, `toggleStar`, `setActive`, `resetToDefaults`) returned by `useStarredModels` are themselves memoized with `useCallback` and have stable dependencies. If they are, then including them in this `useMemo` dependency array is correct. If `useStarredModels` is causing them to re-create, that needs to be addressed in `useStarredModels` first.
2.  **Refine Model Mapping in `fetchCuratedModels` and `fetchAllModels` (lines 46-50, 90-94):**
    *   **Problem**: The `.map()` operations within `fetchCuratedModels` and `fetchAllModels` create new objects (`{ ...model, starred: isStarred(model.id), isActive: isActive(model.id) }`) on every fetch. While necessary to add `starred` and `isActive` properties, ensure `isStarred` and `isActive` are stable functions.
    *   **Recommendation**: These functions (`isStarred`, `isActive`) are already passed from `useStarredModels` and are `useCallback` memoized. This pattern is generally fine. Just ensure that `isStarred` and `isActive` themselves are not causing unnecessary re-renders of the `useModels` hook.
3.  **Conditional Logging (line 107):**
    *   **Problem**: `console.log` statement is present without `process.env.NODE_ENV === 'development'` checks.
    *   **Recommendation**: Wrap `console.log('OpenRouter top 5 models:', data.top5)` with `if (process.env.NODE_ENV === 'development')` to prevent it from appearing in production builds.
4.  **Consistency in API Response Handling:**
    *   **Problem**: Similar to `use-starred-models.ts`, there's a check `if (data.error) { throw new Error(...) }` even after `response.ok` is checked. This implies the API might return a 200 status with an error payload. While robust, it's worth ensuring this is the intended API behavior.
    *   **Recommendation**: Document this API behavior if it's intentional, or consider if the API should return non-200 status codes for errors. If the API *always* returns 200 on success, then the `response.ok` check is sufficient for network errors, and the `data.error` check handles application-level errors.
5.  **`allModels.length` as Dependency for `fetchAllModels` (line 77):**
    *   **Problem**: `allModels.length` is used as a dependency for `fetchAllModels`. This means `fetchAllModels` will be re-created whenever `allModels.length` changes. While the `if (allModels.length > 0) return` guard prevents re-fetching, it's still recreating the function.
    *   **Recommendation**: If `fetchAllModels` is truly intended to be called only once (or on explicit user action), consider removing `allModels.length` from its dependency array and instead use a `useRef` to track if it has been fetched, similar to `hasInitialized` in `initializeCuratedModels`.
6.  **`initializeCuratedModels` Usage:**
    *   **Problem**: `initializeCuratedModels` is a `useCallback` that calls `fetchCuratedModels` only once. It's unclear from this file where `initializeCuratedModels` is actually called.
    *   **Recommendation**: Ensure `initializeCuratedModels` is called appropriately (e.g., in a `useEffect` in a parent component that consumes this hook, or within this hook if it's meant to be an self-initializing on mount). If it's only called once, the `hasInitialized` state and `useCallback` are appropriate.

### `chat-header.tsx` - HIGH PRIORITY (Radix UI Issues)
**Issues:**
1.  **Line 222-305**: Complex Select component with nested conditional rendering.
2.  **Line 358-432**: Duplicate Select component in settings modal.
3.  **Line 54-59**: Model loading handlers called on every dropdown interaction.
4.  **Line 81-94**: `useMemo` for model names but dependencies likely unstable.

**Detailed Recommendations for `chat-header.tsx`:**
1.  **Component Decomposition (High Priority):**
    *   **Problem**: The component is too large and handles too many responsibilities.
    *   **Recommendation**: Break down `ChatHeader` into smaller, more focused sub-components.
        *   `ModelSelector` component: Encapsulate the model selection `Select` logic, including `currentModelName`, `modelOptions`, `handleModelChange`, and `handleModelDropdownOpenChange`. This component would receive `settings.model` and `onSettingsChange` as props, and `useModels` internally.
        *   `SettingsDialog`: Encapsulate the entire `Dialog` content, including all `Tabs` and their content. This component would receive `settings`, `onSettingsChange`, `userId`, `onEndChat`, and the various `handleReset...` functions as props.
        *   Further decompose `SettingsDialog` into `ModelsTabContent`, `LearningTabContent`, `BehaviorTabContent`, `UsageTabContent`, `SettingsTabContent`, and `UploadsTabContent`. Each tab content component would be responsible for its own state and logic, potentially using custom hooks.
2.  **Optimize Radix UI Select Usage (High Priority):**
    *   **Problem**: Complex `Select` rendering logic and potential re-renders.
    *   **Recommendation**:
        *   In the `ModelSelector` component, simplify the `modelOptions` `useMemo`. Instead of generating `SelectItem` JSX directly, generate an array of data that can be mapped to `SelectItem` components in the render function. This separates data preparation from rendering.
        *   Review the `SelectContent` rendering for both model selectors. If the list of models is very long, consider implementing virtualization within the `SelectContent` to improve performance (e.g., using `react-window` or `react-virtualized`).
3.  **Refine `preloadAllData` and Tab Content Loading (Medium Priority):**
    *   **Problem**: The preloading logic might be inefficient or not fully integrated with child component loading.
    *   **Recommendation**:
        *   Ensure `LearningPreferencesTab` and `UsageSummary` truly handle their own data loading and display their own loading states. The `preloadAllData` in `ChatHeader` should primarily trigger these loads, not manage their `preloadedData` state directly.
        *   Consider a more unified data fetching strategy across the application, perhaps using a library like React Query or SWR, which handle caching, revalidation, and loading states more robustly.
4.  **Address `eslint-disable-line` for `handleModelDropdownOpen` (High Priority):**
    *   **Problem**: The suppressed `exhaustive-deps` warning indicates a potential issue with `handleModelDropdownOpen`'s dependencies.
    *   **Recommendation**: Re-evaluate the dependencies of `handleModelDropdownOpen`. If `models.initializeCuratedModels` is a stable function (memoized with `useCallback` in `useModels`), then `modelsLoaded` is the only state that should trigger it. If `models.initializeCuratedModels` is not stable, then `useModels` needs to be fixed first.
5.  **Centralize Default Model List (Medium Priority):**
    *   **Problem**: Hardcoded default models in `AlertDialogDescription`.
    *   **Recommendation**: Import `DEFAULT_ACTIVE_MODELS` from `@/lib/config.ts` and dynamically render the list in the `AlertDialogDescription`. This ensures consistency and easier updates.
6.  **Conditional Logging (Low Priority):
    *   **Problem**: `console.error` statements without `process.env.NODE_ENV` checks.
    *   **Recommendation**: Wrap all `console.error` statements with `if (process.env.NODE_ENV === 'development')` to prevent them from appearing in production builds.
7.  **Custom Provider Filter Dropdown (Medium Priority):**
    *   **Problem**: Manual implementation of a complex dropdown can lead to accessibility and maintenance issues.
    *   **Recommendation**: Explore if `shadcn/ui` or Radix UI offers a more suitable component for multi-select dropdowns or filtering that can be adapted, or ensure the current custom implementation is fully accessible (keyboard navigation, ARIA attributes).
8.  **Memoization Review (Medium Priority):**
    *   **Problem**: While `useMemo` and `useCallback` are used, ensure their dependencies are truly stable to maximize their effectiveness.
    *   **Recommendation**: Conduct a thorough review of all `useMemo` and `useCallback` dependencies within this component and its sub-components to ensure no unnecessary re-creations are occurring.
9.  **State Management for Dialogs (Low Priority):**
    *   **Problem**: Multiple `useState` hooks for `isSettingsOpen`, `isResetDialogOpen`, `isResetKnowledgeOpen`, `isDeleteHistoryOpen`.
    *   **Recommendation**: While not critical, for very complex forms or dialog flows, a `useReducer` could potentially simplify state management, but for simple boolean toggles, `useState` is fine.

### `chat-messages.tsx` - MEDIUM PRIORITY  
**Issues:**
1.  **Line 34-36**: `scrollToBottom` in `useEffect` dependencies may cause loops.
2.  **Line 39-61**: Complex welcome message fade detection logic.
3.  **Line 66-134**: `Map` function creates objects in render cycle.

**Detailed Recommendations for `chat-messages.tsx`:**
1.  **Optimize `scrollToBottom` `useEffect` (lines 34-36):**
    *   **Problem**: The `useEffect` that calls `scrollToBottom` has `messages`, `isLoading`, and `scrollToBottom` itself as dependencies. If `messages` or `isLoading` change frequently, this could lead to excessive scrolling. Including `scrollToBottom` in its own dependency array is redundant if `scrollToBottom` is memoized with `useCallback` and its dependencies are stable.
    *   **Recommendation**:
        *   Remove `scrollToBottom` from its own `useEffect` dependency array. `useCallback` ensures `scrollToBottom` is stable, so it's not needed as a dependency.
        *   Consider adding a condition to `scrollToBottom` to only scroll if the user is already near the bottom of the chat, to avoid interrupting the user if they are reading older messages.
2.  **Simplify Welcome Message Fade Logic (lines 39-61):**
    *   **Problem**: The logic for fading out the welcome message is somewhat complex, involving `prevMessagesRef` and multiple conditions. This can be prone to subtle bugs and difficult to reason about.
    *   **Recommendation**:
        *   The welcome message logic should ideally be managed by the `useChatSession` hook, which is responsible for adding/removing the welcome message. `ChatMessages` should simply render the messages it receives.
        *   If `ChatMessages` *must* handle the fade, simplify the conditions. The fade should primarily be triggered when the first non-welcome message appears. The `prevMessagesRef` is a good pattern for comparing previous props/state.
        *   Ensure the `setTimeout` for `setFadingWelcome(false)` has a clear purpose and doesn't interfere with subsequent renders.
3.  **Optimize Message Mapping (lines 66-134):**
    *   **Problem**: The `messages.map()` function creates new JSX elements on every render. While this is standard React, ensure that the `key` prop is stable and unique for each message (`message.id` is good). Also, ensure that any components rendered within the map (`MessageContent`, `FilePreview`) are themselves optimized (e.g., with `React.memo`) if they are complex and receive stable props.
    *   **Recommendation**:
        *   Review `MessageContent` and `FilePreview` components to ensure they are memoized (`React.memo`) and only re-render when their props change. This is crucial for performance in lists.
        *   The `shouldShowThinking` logic is fine, but ensure the `animate-gentle-pulse` class is applied efficiently and doesn't cause unnecessary re-renders of the entire message item.
4.  **Conditional Logging (throughout):**
    *   **Problem**: `console.log` statements are present without `process.env.NODE_ENV === 'development'` checks.
    *   **Recommendation**: Wrap all `console.log` statements with `if (process.env.NODE_ENV === 'development')` to prevent them from appearing in production builds.
5.  **Prop Drilling (Minor):**
    *   **Problem**: `userId` and `sessionId` are passed down to `MessageContent` and `FilePreview`. While not severe for two props, if this pattern continues, it could lead to prop drilling.
    *   **Recommendation**: For deeply nested components requiring common data, consider using React Context to provide `userId` and `sessionId` (or a `ChatContext` that provides all relevant chat session data) to avoid prop drilling.

### `duck-logo.tsx` - LOW PRIORITY
**Issues:**
1.  **Next.js Image Aspect Ratio Warnings**: The `style` prop on the `Image` component sets `width: 'auto'` and `height: 'auto'`, which overrides the explicit `width` and `height` props and prevents Next.js from correctly inferring the image's aspect ratio, leading to warnings and potential layout shifts.

**Detailed Recommendations for `duck-logo.tsx`:**
1.  **Fix Next.js Image Aspect Ratio Warnings (Critical):**
    *   **Problem**: The `style` prop on the `Image` component sets `width: 'auto'` and `height: 'auto'`, which overrides the explicit `width` and `height` props and prevents Next.js from correctly inferring the image's aspect ratio, leading to warnings and potential layout shifts.
    *   **Recommendation**: Remove the `style` prop that sets `width: 'auto'` and `height: 'auto'`. Rely on the `width` and `height` props passed directly to the `Image` component for aspect ratio calculation. The `object-contain` class will ensure the image scales correctly within the allocated space while maintaining its aspect ratio.
    *   **Current Code (for reference)**:
        ```typescript
        <Image
          src={logoSrc}
          alt={isFullLogo ? "The Duck Chat Logo" : "Duck Logo"}
          width={dimensions.width}
          height={dimensions.height}
          className="object-contain"
          style={{
            width: 'auto',
            height: 'auto',
            maxWidth: dimensions.width,
            maxHeight: dimensions.height
          }}
          priority
        />
        ```
    *   **Proposed Change (for reference)**:
        ```typescript
        <Image
          src={logoSrc}
          alt={isFullLogo ? "The Duck Chat Logo" : "Duck Logo"}
          width={dimensions.width}
          height={dimensions.height}
          className="object-contain"
          // Remove the style prop that sets width/height to auto
          priority
        />
        ```
    *   **Reasoning**: Next.js Image component uses the `width` and `height` props to prevent layout shifts by reserving space. Overriding these with `style={{ width: 'auto', height: 'auto' }}` defeats this purpose. `object-contain` will handle scaling within the `width` and `height` bounds.

### `error-boundary.tsx` - LOW PRIORITY
**Issues:**
1.  **Conditional Logging in `componentDidCatch`**: The `console.error` statement within `componentDidCatch` (line 70) is not conditionally wrapped with `process.env.NODE_ENV === 'development'`.

**Detailed Recommendations for `error-boundary.tsx`:**
1.  **Conditional Logging in `componentDidCatch` (Low Priority):**
    *   **Problem**: The `console.error` statement within `componentDidCatch` (line 70) is not conditionally wrapped with `process.env.NODE_ENV === 'development'`. This means error details will be logged to the console in production, which can be a security risk and unnecessary for end-users.
    *   **Recommendation**: Wrap the `console.error` statement with a development environment check.
    *   **Example:**
        ```typescript
        componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
          if (process.env.NODE_ENV === 'development') {
            console.error('Error Boundary caught an error:', error, errorInfo);
          }
          // ... rest of the code
        }
        ```
2.  **Consider Centralized Error Reporting (Medium Priority):**
    *   **Problem**: While `console.error` is used, there's no integration with a centralized error reporting service (e.g., Sentry, Bugsnag, Datadog RUM). In a production application, relying solely on console logs for error tracking is insufficient.
    *   **Recommendation**: If not already implemented elsewhere, consider integrating a dedicated error reporting service. The `onError` prop in `ErrorBoundaryProps` is a good place to hook this in.
    *   **Example (conceptual):**
        ```typescript
        // In your main App component or a global setup file
        import * as Sentry from '@sentry/react'; // Example Sentry import

        <ErrorBoundary
          onError={(error, errorInfo) => {
            if (process.env.NODE_ENV === 'production') {
              Sentry.captureException(error, { extra: errorInfo });
            }
          }}
        >
          <App />
        </ErrorBoundary>
        ```
3.  **More Specific Error Messages in Production (Low Priority):**
    *   **Problem**: The `DefaultErrorFallback` provides a generic "Something went wrong" message in production. While safe, it might not be helpful for debugging or for users to understand what happened.
    *   **Recommendation**: For certain types of errors (e.g., network errors, authentication errors), you might want to provide slightly more specific, but still user-friendly, messages without exposing sensitive details. This would require more sophisticated error handling and mapping.
4.  **Accessibility of `DefaultErrorFallback` (Low Priority):**
    *   **Problem**: The `details` and `summary` tags are used for error details. While generally accessible, ensure proper ARIA attributes and keyboard navigation are considered if this component is used in a critical user flow.
    *   **Recommendation**: Review the accessibility of the `DefaultErrorFallback` component, especially the interactive elements.

### `theme-provider.tsx` - CLEAN
**Issues:** None.

**Detailed Recommendations for `theme-provider.tsx`:**
This file is a simple wrapper around `next-themes`'s `ThemeProvider`. It is clean and does not require any specific recommendations beyond ensuring that `next-themes` itself is kept up to date and configured correctly in `next.config.ts` if there are any specific requirements for theme resolution.

### `auth-provider.tsx` - LOW PRIORITY
**Issues:**
1.  **Redundant `console.log` checks**: Some `console.log` statements have redundant `if (process.env.NODE_ENV === 'development')` checks inside an already checked block.
2.  **`supabase` and `supabase.auth` checks**: Repeated checks for `supabase && supabase.auth` and `typeof supabase.auth.getSession === 'function'` or `typeof supabase.auth.onAuthStateChange === 'function'`.
3.  **Error Handling in `getInitialSession` and `onAuthStateChange`**: Errors are caught and logged, but the `setDebugInfo` message might not always be clear enough for debugging.
4.  **`logout` function**: The `logout` function checks `isConfigured` and `supabase && 'signOut' in supabase.auth`. `isConfigured` already implies `supabase` is not null.
5.  **`debugInfo` state**: The `debugInfo` state is used for internal debugging messages and is exposed in the `AuthContextType`.

**Detailed Recommendations for `auth-provider.tsx`:**
1.  **Remove Redundant `console.log` Checks (Minor):**
    *   **Problem**: Some `console.log` statements have redundant `if (process.env.NODE_ENV === 'development')` checks inside an already checked block.
    *   **Recommendation**: Remove the inner redundant checks. The outer `if (process.env.NODE_ENV === 'development')` is sufficient.
    *   **Example:**
        ```typescript
        // Before
        if (process.env.NODE_ENV === 'development') {
          if (process.env.NODE_ENV === 'development') console.log('Auth: Checking for existing session...');
        }
        // After
        if (process.env.NODE_ENV === 'development') {
          console.log('Auth: Checking for existing session...');
        }
        ```
2.  **Consolidate `supabase` and `supabase.auth` Checks (Minor):**
    *   **Problem**: Repeated checks for `supabase && supabase.auth` and `typeof supabase.auth.getSession === 'function'` or `typeof supabase.auth.onAuthStateChange === 'function'`.
    *   **Recommendation**: While not critical, consider extracting these checks into a helper function or a more concise conditional block if they become too repetitive across the codebase. For this file, it's acceptable but could be slightly cleaner.
3.  **Enhance Error Messages in `debugInfo` (Minor):**
    *   **Problem**: Errors in `getInitialSession` and `onAuthStateChange` are caught and logged, but the `setDebugInfo` message might not always be clear enough for debugging.
    *   **Recommendation**: Ensure the error messages provided to `setDebugInfo` are as informative as possible, perhaps including the error stack in development mode. For example, `setDebugInfo(`Auth error: ${error instanceof Error ? error.message : 'Unknown error'} ${process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : ''}`);`
4.  **Refine `logout` Function Logic (Minor):**
    *   **Problem**: The `logout` function checks `isConfigured` and `supabase && 'signOut' in supabase.auth`. `isConfigured` already implies `supabase` is not null if `isSupabaseConfigured` is implemented correctly.
    *   **Recommendation**: If `isSupabaseConfigured` truly guarantees `supabase` is a valid object, then the `supabase &&` part of the condition in `logout` can be simplified to just `isConfigured && 'signOut' in supabase.auth`. However, if `isSupabaseConfigured` only checks environment variables, the current check is safer.
5.  **Conditional Exposure of `debugInfo` (Minor):**
    *   **Problem**: The `debugInfo` state is used for internal debugging messages and is exposed in the `AuthContextType`.
    *   **Recommendation**: While `process.env.NODE_ENV` checks are used for logging, ensure that the `debugInfo` property itself is not consumed or displayed in production UI. This is more of a usage concern than a code issue within this file, but it's good to be mindful of what context values are exposed.

### `user-menu.tsx` - LOW PRIORITY
**Issues:**
1.  **`getInitials` Function Logic**: The `getInitials` function might not handle all edge cases for names (e.g., single-word names, names with multiple spaces).
2.  **Error Handling for `deleteUser`**: The `catch` block for `deleteUser` is generic and doesn't differentiate between different types of errors.
3.  **Redundant `onSelect` for `DropdownMenuItem`**: The `onSelect={(e) => e.preventDefault()}` on the `Delete User` `DropdownMenuItem` is likely redundant if the `DialogTrigger` is handling the click.

**Detailed Recommendations for `user-menu.tsx`:**
1.  **Robust `getInitials` Function (Minor):**
    *   **Problem**: The `getInitials` function might not handle all edge cases for names (e.g., single-word names, names with multiple spaces). For a single-word name, `names[names.length - 1][0]` would still work, but it's less explicit.
    *   **Recommendation**: Consider a more robust implementation for `getInitials` that explicitly handles single-word names or names with unusual spacing. For example:
        ```typescript
        const getInitials = (name: string) => {
          const parts = name.trim().split(/\s+/);
          if (parts.length === 0) return 'U'; // Default for empty string
          if (parts.length === 1) return parts[0][0].toUpperCase();
          return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        };
        ```
2.  **Specific Error Handling for `deleteUser` (Minor):**
    *   **Problem**: The `catch` block for `deleteUser` is generic and doesn't differentiate between different types of errors. This makes it harder to provide specific feedback to the user.
    *   **Recommendation**: If `deleteUser` can throw specific error types or include error codes, handle them to provide more precise toast messages. For example, if there's an authentication error vs. a server error.
3.  **Review `onSelect` for `DropdownMenuItem` (Minor):**
    *   **Problem**: The `onSelect={(e) => e.preventDefault()}` on the `Delete User` `DropdownMenuItem` is likely redundant if the `DialogTrigger` is correctly handling the click event to open the dialog. `onSelect` is typically used for actions that *don't* open another component.
    *   **Recommendation**: Test if removing `onSelect={(e) => e.preventDefault()}` still correctly opens the `Dialog`. If it does, remove the redundant `onSelect` prop for cleaner code.
4.  **Accessibility (Minor):**
    *   **Problem**: Ensure the `DropdownMenu` and `Dialog` components are fully accessible, including keyboard navigation and ARIA attributes. `shadcn/ui` components generally handle this well, but custom implementations or complex nesting can sometimes introduce issues.
    *   **Recommendation**: Perform a quick accessibility audit, especially for keyboard navigation through the dropdown and dialog.

### `billing-notice.tsx` - LOW PRIORITY
**Issues:**
1.  **Hardcoded Text**: The billing notice message contains hardcoded text about the beta period and monthly limit.
2.  **Icon Mapping**: The `icons` object uses `X` for the `error` variant, which might be confusing as `X` is also used for the dismiss button.
3.  **Credit Warning Logic**: The `CreditWarning` component uses `percentage` to determine styling, but the styling is applied directly in `cn` without using the `variant` prop, making it less consistent with `BillingNotice`.

**Detailed Recommendations for `billing-notice.tsx`:**
1.  **Externalize Hardcoded Text (Minor):**
    *   **Problem**: The billing notice message contains hardcoded text about the beta period and monthly limit. This makes it difficult to update or localize without code changes.
    *   **Recommendation**: Move the message content to a configuration file (e.g., `config.ts` or a dedicated `messages.ts` file) or pass it as a prop. This allows for easier updates and internationalization.
2.  **Clarify Icon Usage (Minor):**
    *   **Problem**: The `icons` object uses `X` for the `error` variant, which might be confusing as `X` is also used for the dismiss button. While context usually clarifies, it's a minor inconsistency.
    *   **Recommendation**: Consider using a different icon for the `error` variant (e.g., `AlertCircle` or `AlertOctagon`) to avoid ambiguity with the dismiss button.
3.  **Consistent Styling for `CreditWarning` (Minor):**
    *   **Problem**: The `CreditWarning` component uses `percentage` to determine styling, but the styling is applied directly in `cn` without using the `variant` prop, making it less consistent with `BillingNotice`.
    *   **Recommendation**: Refactor `CreditWarning` to accept a `variant` prop (e.g., `'info' | 'warning' | 'error'`) and map it to the appropriate Tailwind classes, similar to how `BillingNotice` does. This improves consistency and reusability.
4.  **`showDismiss` Prop Usage (Minor):**
    *   **Problem**: The `showDismiss` prop defaults to `true`. If a notice is always meant to be dismissible, this is fine. If there are cases where it should *never* be dismissible, ensure that's handled correctly by the consumer.
    *   **Recommendation**: No immediate change needed, but a note for future development: if non-dismissible notices become common, consider making `showDismiss` explicitly required or defaulting to `false` and requiring it to be `true` when needed.

### `chat-container.tsx` - LOW PRIORITY
**Issues:**
1.  **`_isPageLoading` parameter**: The `_isPageLoading` parameter is acknowledged as unused using `void _isPageLoading;`.
2.  **Prop Drilling**: While hooks help, some props are still passed down through multiple layers (e.g., `userId`, `sessionId`).
3.  **`messageCount` calculation**: `messageCount={messages.length - 1}` assumes the welcome message is always present and is the only non-user/assistant message.

**Detailed Recommendations for `chat-container.tsx`:**
1.  **Remove Unused Parameters (Minor):**
    *   **Problem**: The `_isPageLoading` parameter is acknowledged as unused using `void _isPageLoading;`. This indicates it's no longer needed or was a remnant from previous code.
    *   **Recommendation**: Remove `_isPageLoading` from the `ChatContainerProps` interface and the component's destructuring if it's truly unused. This cleans up the interface and component signature.
2.  **Consider React Context for Prop Drilling (Medium Priority):**
    *   **Problem**: While custom hooks (`useChatSession`, `useMessageHandling`, etc.) encapsulate logic, some props like `userId` and `sessionId` are still passed down through multiple components (`ChatContainer` -> `ChatHeader`, `ChatMessages`, `ChatInput`). This is a form of prop drilling.
    *   **Recommendation**: For common data like `userId` and `sessionId` that many components might need, consider creating a React Context (e.g., `ChatContext` or `AuthContext` if `userId` is always from auth) to provide these values. This reduces the number of props passed down and makes components more reusable.
3.  **Robust `messageCount` Calculation (Minor):**
    *   **Problem**: `messageCount={messages.length - 1}` assumes the welcome message is always present and is the only non-user/assistant message. If the welcome message is removed or other system messages are introduced, this calculation might be inaccurate.
    *   **Recommendation**: Make the `messageCount` calculation more robust by explicitly filtering for user and assistant messages, or by ensuring `messages.length - 1` is always the correct count of actual conversational messages.
    *   **Example:**
        ```typescript
        messageCount={messages.filter(msg => msg.role === 'user' || msg.role === 'assistant').length}
        ```
4.  **`React.memo` Usage (Minor):**
    *   **Problem**: `ChatContainer` is wrapped in `React.memo`. While generally good for performance, ensure that all props passed to `ChatContainer` are stable (primitives, memoized functions, memoized objects) to fully leverage `React.memo` and prevent unnecessary re-renders of the entire container.
    *   **Recommendation**: Review the stability of `initialMessages`, `onSessionUpdate`, `onToggleMobileSidebar`, and `onTitleGenerated` if they are not already guaranteed to be stable by their origin.

### `chat-history-sidebar.tsx` - MEDIUM PRIORITY
**Issues:**
1.  **Redundant `useEffect` for `loadCachedSessions`**: `loadCachedSessions` is called in an `useEffect` (lines 140-144) that depends on `user` and `loadCachedSessions` itself. `loadCachedSessions` is a `useCallback` that depends on `user`, creating a potential circular dependency or unnecessary re-creation.
2.  **`fetchChatHistory` Dependencies**: The `fetchChatHistory` `useCallback` has `sessions.length` as a dependency (line 159), which can cause it to be re-created whenever the number of sessions changes, potentially leading to unnecessary re-fetches.
3.  **Search Debounce Logic**: The `useEffect` for search debounce (lines 162-172) re-fetches the entire history even when `searchQuery` is empty, which might be inefficient.
4.  **Conditional Logging**: `console.error` statements are not conditionally wrapped with `process.env.NODE_ENV === 'development'`.
5.  **`isGeneratingTitle` State**: `isGeneratingTitle` is a string (`sessionId` or `null`), which is used to track the loading state for title generation. While functional, a boolean state might be simpler if only one title can be generated at a time.
6.  **`formatDate` Logic**: The `formatDate` function has a complex logic for displaying time differences.

**Detailed Recommendations for `chat-history-sidebar.tsx`:**
1.  **Optimize `loadCachedSessions` and `fetchChatHistory` `useEffect`s (Medium Priority):**
    *   **Problem**: The current setup for loading cached sessions and then fetching fresh data has potential for redundant calls and complex dependency management.
    *   **Recommendation**:
        *   **Simplify Initial Load**: Combine the initial loading logic. On mount, first attempt to load from cache. Then, in a separate `useEffect` that runs only once (or when `user` becomes available), trigger `fetchChatHistory` to get fresh data, but ensure it's not re-fetch if data is already present and fresh.
        *   **Refine `fetchChatHistory` Dependencies**: Remove `sessions.length` from `fetchChatHistory`'s dependency array. Instead, `fetchChatHistory` should be called explicitly when a refresh is needed (e.g., `refreshTrigger` changes, or after a session is deleted/title generated). The `isStale()` check is good for revalidation.
2.  **Improve Search Debounce and Fetching (Medium Priority):**
    *   **Problem**: The search `useEffect` re-fetches the entire history when `searchQuery` becomes empty, which is inefficient. It should ideally revert to displaying the full, non-searched history without re-fetching if it's already available.
    *   **Recommendation**:
        *   Modify the search `useEffect` to only call `fetchChatHistory(searchQuery)` when `searchQuery` has at least 2 characters. When `searchQuery` is empty, simply reset `isSearching` and rely on the `sessions` state (which should hold the full history when not searching).
        *   Ensure `fetchChatHistory` can differentiate between a full history fetch and a search query fetch, and update the `sessions` state accordingly.
3.  **Conditional Logging (Low Priority):**
    *   **Problem**: `console.error` statements are not conditionally wrapped with `process.env.NODE_ENV === 'development'`.
    *   **Recommendation**: Wrap all `console.error` statements with `if (process.env.NODE_ENV === 'development')` to prevent them from appearing in production builds.
4.  **`isGeneratingTitle` State (Minor):**
    *   **Problem**: Using `sessionId` as the state for `isGeneratingTitle` is functional but can be slightly less readable than a boolean if only one title can be generated at a time. If multiple titles could be generated concurrently, then the current approach is fine.
    *   **Recommendation**: If only one title generation can occur at a time, consider a boolean `isGeneratingTitle` state. If concurrent generation is possible, the current approach is appropriate.
5.  **`formatDate` Optimization (Minor):**
    *   **Problem**: The `formatDate` function is a `useCallback`, but its logic is somewhat verbose for common date formatting. While functional, it could be simplified.
    *   **Recommendation**: For more complex or localized date formatting, consider using a dedicated date library like `date-fns` or `moment.js` (if not already using one) to simplify the logic and ensure consistency.
6.  **Optimistic Updates for Delete/Generate Title (Medium Priority):**
    *   **Problem**: When a session is deleted or a title is generated, the UI updates only after the API call is successful. This can lead to a slight delay.
    *   **Recommendation**: Implement optimistic updates for `deleteSession` and `generateTitle`. For `deleteSession`, immediately remove the session from the `sessions` state and then revert if the API call fails. For `generateTitle`, immediately update the session's title in the state and revert on failure.
7.  **Accessibility (Minor):**
    *   **Problem**: Ensure the search input, buttons, and dropdown menus are fully accessible, including keyboard navigation and ARIA attributes.
    *   **Recommendation**: Perform an accessibility audit, especially for interactive elements.
8.  **`refreshTrigger` Usage (Minor):**
    *   **Problem**: The `refreshTrigger` prop is used to force a refresh. While functional, consider if a more explicit `refetch` function returned by the hook would be clearer than relying on a changing number prop.
    *   **Recommendation**: No immediate change needed, but a pattern to consider for future hooks.

### `chat-input.tsx` - MEDIUM PRIORITY
**Issues:**
1.  **`handleDrawingCreate` `userId` and `sessionId`**: The `userId` and `sessionId` are passed directly to `handleDrawingCreate` and then used to create a `FileUpload` object, but `storage_path` is empty and `url` is a temporary `createObjectURL`.
2.  **`FileUploadComponent` `sessionId` prop**: The `sessionId` prop is passed to `FileUploadComponent` but then immediately ignored (`_sessionId`) within that component.
3.  **Redundant `disabled` checks**: Multiple `disabled` checks in JSX.
4.  **Conditional Logging**: `logger.dev.log` statements are used, but `console.error` is used without conditional checks.
5.  **`MAX_FILE_SIZE` import**: `MAX_FILE_SIZE` is imported from `@/types/file-upload` but it's a constant, not a type.

**Detailed Recommendations for `chat-input.tsx`:**
1.  **Refine `handleDrawingCreate` Logic (Medium Priority):**
    *   **Problem**: The `handleDrawingCreate` function creates a `FileUpload` object with an empty `storage_path` and a temporary `URL.createObjectURL`. This `FileUpload` object is then added to `attachments`. The actual upload to Supabase and obtaining a permanent URL/storage path is not handled here.
    *   **Recommendation**:
        *   `handleDrawingCreate` should ideally trigger the upload process to Supabase directly, similar to how `FileUploadComponent` handles file uploads. Once the drawing is successfully uploaded and a permanent URL/storage path is obtained, then `onFileUploaded` should be called with the complete `FileUpload` object.
        *   Alternatively, if `handleDrawingCreate` is only meant to prepare the drawing for attachment, then the `FileUpload` object should clearly indicate its temporary nature and the `onSendMessage` function should be responsible for initiating the actual upload of all attachments.
2.  **Correct `sessionId` Prop Usage in `FileUploadComponent` (Medium Priority):**
    *   **Problem**: The `sessionId` prop is passed to `FileUploadComponent` but then immediately ignored (`_sessionId`) within that component. This indicates a disconnect in how `sessionId` is intended to be used for file uploads.
    *   **Recommendation**: If `sessionId` is needed for file uploads (e.g., to associate the uploaded file with a session immediately), then `FileUploadComponent` should correctly use this prop. If it's not needed during the initial upload, then it shouldn't be passed or should be clearly documented why it's ignored.
3.  **Consolidate `disabled` Checks (Minor):**
    *   **Problem**: Multiple `disabled` checks in JSX (e.g., `disabled={disabled || !userId}`).
    *   **Recommendation**: For readability and maintainability, consider creating a single computed boolean variable for the disabled state at the top of the component's render function. Example: `const isInputDisabled = disabled || !userId;` and then use `disabled={isInputDisabled}`.
4.  **Consistent Logging (Minor):**
    *   **Problem**: `logger.dev.log` statements are used, but `console.error` is used without conditional checks.
    *   **Recommendation**: Wrap all `console.error` statements with `if (process.env.NODE_ENV === 'development')` to prevent them from appearing in production builds.
5.  **Correct `MAX_FILE_SIZE` Import (Minor):**
    *   **Problem**: `MAX_FILE_SIZE` is imported from `@/types/file-upload` but it's a constant, not a type. While it works, it's semantically incorrect.
    *   **Recommendation**: Move `MAX_FILE_SIZE` to a constants file (e.g., `config.ts` or a new `constants.ts` in `lib`) and import it from there. This clarifies its nature as a value rather than a type.
6.  **Textarea Auto-resize `useEffect` (Minor):**
    *   **Problem**: The `useEffect` for auto-resizing the textarea runs on every `message` change. While necessary, ensure it's efficient.
    *   **Recommendation**: The current implementation is a standard pattern for auto-resizing textareas and is generally fine. No specific changes needed unless performance issues are observed.
7.  **Attachment Management (Minor):**
    *   **Problem**: The `attachments` state is managed locally. If the component unmounts or the user navigates away before sending the message, the attachments might be lost.
    *   **Recommendation**: For a more robust solution, especially if attachments can be large or numerous, consider persisting attachments to a temporary cache (e.g., `sessionStorage` or a global state management solution) until the message is successfully sent.

### `file-preview.tsx` - LOW PRIORITY
**Issues:**
1.  **`eslint-disable` comments**: `/* eslint-disable @next/next/no-img-element */` and `/* eslint-disable jsx-a11y/alt-text */` are used.
2.  **`getFileUrl` calls**: `getFileUrl` is called multiple times, potentially redundantly.
3.  **Error Handling for `getFileUrl`**: The `handleView` and `handleDownload` functions call `getFileUrl` and handle errors, but the `previewUrl` state might not always be up-to-date.
4.  **`X` icon for error variant**: In `BillingNotice`, the `X` icon is used for the `error` variant, which might be confusing as `X` is also used for the dismiss button.

**Detailed Recommendations for `file-preview.tsx`:**
1.  **Address `eslint-disable` Comments (Minor):**
    *   **Problem**: The `eslint-disable` comments indicate potential issues that are being ignored. `no-img-element` suggests using `next/image` for optimization, and `jsx-a11y/alt-text` points to accessibility concerns.
    *   **Recommendation**:
        *   **`no-img-element`**: If possible, replace the native `<img>` tag with Next.js's `Image` component for better performance optimizations (lazy loading, image optimization). This might require pre-determining image dimensions or using `fill` prop with parent container styling.
        *   **`jsx-a11y/alt-text`**: Ensure that the `alt` attribute for the `<img>` tag is always meaningful. The current `alt={file.file_name}` is generally good, but review if `file.file_name` always provides sufficient context for accessibility.
2.  **Optimize `getFileUrl` Calls (Minor):**
    *   **Problem**: `getFileUrl` is called multiple times (e.g., in `handleView` and `handleDownload`), potentially leading to redundant API calls if the URL is already known or recently fetched.
    *   **Recommendation**: If `previewUrl` is already set and valid, reuse it. Only call `getFileUrl` if `previewUrl` is `undefined` or `null`. The current implementation does this for `handleView`, but `handleDownload` could also benefit from checking `previewUrl` first.
3.  **Consistent Error Handling for `getFileUrl` (Minor):**
    *   **Problem**: The error handling for `getFileUrl` in `handleView` and `handleDownload` is slightly different. Also, the `previewUrl` state might not always be up-to-date if `getFileUrl` fails.
    *   **Recommendation**: Ensure consistent error handling. If `getFileUrl` fails, consider clearing `previewUrl` to indicate that the URL is no longer valid. Also, ensure the `toast` messages are consistent.
4.  **Memoize `getFileIcon` (Minor):**
    *   **Problem**: `getFileIcon` is called on every render. While it's a simple function, for a large list of files, it could lead to minor performance overhead.
    *   **Recommendation**: Wrap `getFileIcon` in `useCallback` if its dependencies are stable, or if it's passed down to child components. In this component, it's called directly in JSX, so `useCallback` might not provide significant benefits unless the component re-renders frequently for reasons other than `file` prop changes.
5.  **`FileUploadService` Instantiation (Minor):**
    *   **Problem**: `new FileUploadService()` is instantiated on every render. While `FileUploadService` might be lightweight, it's generally better to instantiate services once.
    *   **Recommendation**: Instantiate `FileUploadService` outside the component or use `useMemo` to memoize its instance: `const fileUploadService = useMemo(() => new FileUploadService(), []);` (This has already been done in `file-upload.tsx`, so apply the same pattern here).
6.  **Clarity of `url` prop**: The `url` prop is optional, but then `previewUrl` state is used. It might be clearer to always derive `previewUrl` from `file.storage_path` and `getFileUrl` if `url` is not provided.

### `file-upload.tsx` - MEDIUM PRIORITY
**Issues:**
1.  **`_sessionId` unused parameter**: The `sessionId` prop is destructured as `_sessionId` and marked as unused.
2.  **`MAX_FILE_SIZE` import**: `MAX_FILE_SIZE` is imported from `@/types/file-upload` but it's a constant, not a type.
3.  **`getFileExtensions` import**: `getFileExtensions` is imported from `@/types/file-upload` but it's a function, not a type.
4.  **`fileUploadService` instantiation**: `fileUploadService` is memoized with an empty dependency array, which is good.
5.  **Error Handling for `uploadFile`**: The `result.error` is used directly in the toast description, which might expose internal error messages.

**Detailed Recommendations for `file-upload.tsx`:**
1.  **Address `_sessionId` Unused Parameter (Minor):**
    *   **Problem**: The `sessionId` prop is destructured as `_sessionId` and marked as unused. This indicates that `sessionId` is passed to this component but not actually used within it.
    *   **Recommendation**: If `sessionId` is truly not needed in `FileUploadComponent`, remove it from the `FileUploadComponentProps` interface and the component's destructuring. If it *is* needed (e.g., for associating the uploaded file with a session immediately), then it should be used correctly.
2.  **Correct `MAX_FILE_SIZE` and `getFileExtensions` Imports (Minor):**
    *   **Problem**: `MAX_FILE_SIZE` and `getFileExtensions` are imported from `@/types/file-upload` but they are constants/functions, not types. While it works, it's semantically incorrect and can lead to confusion.
    *   **Recommendation**: Move `MAX_FILE_SIZE` and `getFileExtensions` to a constants/utility file (e.g., `config.ts` or a new `constants.ts` in `lib`) and import them from there. This clarifies their nature as values/functions rather than types.
3.  **Refine Error Message for `uploadFile` (Medium Priority):**
    *   **Problem**: The `result.error` is used directly in the toast description, which might expose internal error messages to the user.
    *   **Recommendation**: Provide a more user-friendly and generic error message for the toast, and log the detailed `result.error` to the console (conditionally for development) or to a centralized error reporting service.
4.  **File Type Icons (Minor):**
    *   **Problem**: The `getFileIcon` function has a series of `if (file.type.includes(...))` checks. While functional, it can become verbose if many file types are added.
    *   **Recommendation**: Consider a more extensible mapping for file types to icons, perhaps using a lookup object or a utility function that maps MIME types to a predefined set of icons.
5.  **Accessibility (Minor):**
    *   **Problem**: Ensure the drag-and-drop area and file input are fully accessible, including keyboard navigation and ARIA attributes.
    *   **Recommendation**: Perform an accessibility audit for the file upload component.
6.  **Progress Bar Update (Minor):**
    *   **Problem**: The `setUploadProgress` is called with `loaded: 0, total: selectedFile.size, percentage: 0` at the start of upload, but the actual progress updates are not shown in this component's code. It's assumed `FileUploadService` handles the updates.
    *   **Recommendation**: Ensure `FileUploadService` provides a mechanism to update the progress (e.g., a callback function) and that this component correctly consumes those updates to show real-time progress.

### `learning-preferences-tab.tsx` - MEDIUM PRIORITY
**Issues:**
1.  **Hardcoded `WEIGHT_LABELS` and `CATEGORIES`**: These are hardcoded within the component.
2.  **`filteredPreferences` Logic**: The filtering logic for `filteredPreferences` is directly within the component's render scope.
3.  **Error Handling for Add/Update/Delete**: `console.error` is used without conditional checks.
4.  **`summary` Prop**: The `summary` prop from `useLearningPreferences` is used with optional chaining (`summary?.total_preferences`), but its structure might be more reliably typed.
5.  **`addForm` State Reset**: The `addForm` state is reset after `addPreference`.

**Detailed Recommendations for `learning-preferences-tab.tsx`:**
1.  **Externalize Constants (Minor):**
    *   **Problem**: `WEIGHT_LABELS` and `CATEGORIES` are hardcoded within the component. This makes them less reusable and harder to manage if they need to be updated or localized.
    *   **Recommendation**: Move `WEIGHT_LABELS` and `CATEGORIES` to a dedicated constants file (e.g., `config.ts` or a new `constants.ts` in `lib`). Import them into the component.
2.  **Memoize `filteredPreferences` (Medium Priority):**
    *   **Problem**: The `filteredPreferences` array is re-calculated on every render. While `filter` is efficient, for a large number of preferences or frequent re-renders, this could lead to unnecessary computation.
    *   **Recommendation**: Wrap the `filteredPreferences` calculation in a `useMemo` hook, with `preferences`, `selectedCategory`, and `searchTerm` as dependencies. This ensures the array is only re-calculated when these dependencies change.
3.  **Conditional Logging (Minor):**
    *   **Problem**: `console.error` statements are used without conditional checks.
    *   **Recommendation**: Wrap all `console.error` statements with `if (process.env.NODE_ENV === 'development')` to prevent them from appearing in production builds.
4.  **Type Safety for `summary` (Minor):**
    *   **Problem**: The `summary` prop from `useLearningPreferences` is used with optional chaining (`summary?.total_preferences`), but its structure might be more reliably typed.
    *   **Recommendation**: Ensure the `summary` object returned by `useLearningPreferences` is fully typed, so optional chaining is used only when a property is truly optional, improving type safety and readability.
5.  **Clearer `addForm` Reset (Minor):**
    *   **Problem**: The `addForm` state is reset after `addPreference`.
    *   **Recommendation**: The current reset is functional. No specific change needed, but ensure the reset values align with the initial state of the form.
6.  **Accessibility (Minor):**
    *   **Problem**: Ensure the sliders, selects, and input fields are fully accessible, including keyboard navigation and ARIA attributes.
    *   **Recommendation**: Perform an accessibility audit for the learning preferences tab.
7.  **`WEIGHT_LABELS` Type Safety (Minor):**
    *   **Problem**: `WEIGHT_LABELS[addForm.weight]` is used, assuming `addForm.weight` will always be a valid key. While the slider constrains it, it's good practice to ensure type safety.
    *   **Recommendation**: No immediate change needed, as the slider limits the values. However, if `WEIGHT_LABELS` were to be used with arbitrary numbers, a lookup with a default fallback would be safer.

### `storage-indicator.tsx` - CLEAN
**Issues:** None.

**Detailed Recommendations for `storage-indicator.tsx`:**
This component is simple and appears to be clean. It effectively displays a message based on its props. No specific recommendations.

### `message-content.tsx` - MEDIUM PRIORITY
**Issues:**
1.  **`CodeBlock` `useState` for `syntaxStyle`**: The `CodeBlock` component uses `useState` for `syntaxStyle` and then immediately calls `loadSyntaxStyles` in `useEffect`. While `dynamic` import helps, `useState` and `useEffect` here might cause an extra render cycle. The `any` type for `syntaxStyle` should also be addressed.
2.  **`console.error` without conditional checks**: The `copyToClipboard` function uses `console.error` without checking `process.env.NODE_ENV`.
3.  **Markdown component optimization**: The custom components passed to `ReactMarkdown` (e.g., `ul`, `ol`, `h1`, `p`) are defined inline. This means they are re-created on every render of `MessageContent`, potentially causing unnecessary re-renders of their children if those children are memoized.

**Detailed Recommendations for `message-content.tsx`:**
1.  **Optimize `CodeBlock` `syntaxStyle` Loading (Medium Priority):**
    *   **Problem**: The `CodeBlock` component uses `useState` for `syntaxStyle` and then immediately calls `loadSyntaxStyles` in `useEffect`. This pattern can lead to an extra render cycle. Also, the `any` type for `syntaxStyle` reduces type safety.
    *   **Recommendation**:
        *   **Type `syntaxStyle`**: Define a proper type for `syntaxStyle` based on the expected return type of `loadSyntaxStyles` (which is a Prism style object). This will improve type safety.
        *   **Consider `use` hook or direct import**: If `loadSyntaxStyles` is truly synchronous or can be made synchronous, consider calling it directly or using React's `use` hook (if applicable in your Next.js version) to fetch the style. If it must be asynchronous, the current `useEffect` pattern is acceptable, but be mindful of the extra render.
2.  **Conditional Logging (Minor):**
    *   **Problem**: The `copyToClipboard` function uses `console.error` without checking `process.env.NODE_ENV`. The debug logging for artifact rendering also uses `console.log` without conditional checks.
    *   **Recommendation**: Wrap all `console.error` and `console.log` statements with `if (process.env.NODE_ENV === 'development')` to prevent them from appearing in production builds.
3.  **Memoize Markdown Custom Components (Medium Priority):**
    *   **Problem**: The custom components passed to `ReactMarkdown` (e.g., `ul`, `ol`, `h1`, `p`) are defined inline within the `MessageContent` component. This means these component definitions are re-created on every render of `MessageContent`. If these custom components are complex or have memoized children, this re-creation can lead to unnecessary re-renders of those children.
    *   **Recommendation**: Define these custom components outside the `MessageContent` component or memoize them using `useCallback` if they depend on props from `MessageContent`. For simple components like `ul`, `ol`, `h1`, `p`, defining them outside is usually sufficient.
4.  **`React.memo` for `MessageContent` (Low Priority):**
    *   **Problem**: `MessageContent` itself is not wrapped in `React.memo`. Given it renders potentially complex Markdown and artifacts, and receives `content`, `message`, `userId`, and `sessionId` as props, it might benefit from `React.memo` to prevent unnecessary re-renders if its props are stable.
    *   **Recommendation**: Wrap `MessageContent` in `React.memo` and ensure its props (`content`, `message`, `userId`, `sessionId`) are stable. `message` is an object, so ensure it's not being recreated unnecessarily in the parent component (`ChatMessages`).
5.  **Prop Drilling (Minor):**
    *   **Problem**: `userId` and `sessionId` are passed down to `MessageContent` and then further to `useArtifacts` and `useArtifactPanel`. While not severe for two props, if this pattern continues, it could lead to prop drilling.
    *   **Recommendation**: For deeply nested components requiring common data, consider using React Context to provide `userId` and `sessionId` (or a `ChatContext` that provides all relevant chat session data) to avoid prop drilling.
6.  **`getArtifactsFromMessage` and `loadArtifact` dependencies**: The `useArtifacts` hook is used, and `getArtifactsFromMessage` and `loadArtifact` are functions returned from it. Ensure that `useArtifacts` itself is stable and its returned functions are memoized with `useCallback` if they depend on changing values, to prevent unnecessary re-renders of `MessageContent`.
7.  **`Suspense` fallback for `CodeBlock`**: The `Suspense` fallback for `CodeBlock` is a `div` with a loading message. This is functional, but ensure the user experience is smooth, especially if many code blocks are present.

### `duckpond-viewer.tsx` - HIGH PRIORITY
**Issues:**
1.  **Iframe Sandboxing**: The `sandbox` attribute is used with `allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-popups`. While these are common, `allow-same-origin` combined with `allow-scripts` can potentially allow scripts in the iframe to access the parent frame if the origins match, which might be a security concern depending on the content being rendered.
2.  **React Component Execution in Iframe**: The method of injecting React code and relying on global `window` properties for component detection and rendering (`window.YourComponentName = YourComponentName;`) is fragile and prone to issues. It relies on the component being globally exposed and correctly named.
3.  **Code Duplication**: The resize handle logic is duplicated for both the `preview` and `code` tabs.
4.  **Error Handling in Iframe**: Error messages displayed within the iframe are basic and might not provide enough detail for debugging. The `console.error` calls within the iframe's script are not conditionally logged.
5.  **`setTimeout` for Iframe Rendering**: The `setTimeout` (50ms delay) before rendering the React component in the iframe is a heuristic and might not guarantee the DOM is fully ready, or could introduce unnecessary delay.
6.  **Global `window` overrides in sandbox**: Overriding `window.setTimeout`, `window.setInterval`, `window.requestAnimationFrame`, etc., within the sandbox is generally not recommended as it can interfere with the expected behavior of libraries or the browser itself.
7.  **`getFileExtension` helper**: This is a simple helper function that could be externalized or memoized if used frequently.
8.  **Conditional Logging**: `console.log` and `console.error` statements are present without `process.env.NODE_ENV` checks.

**Detailed Recommendations for `duckpond-viewer.tsx`:**
1.  **Review Iframe Sandboxing and Security (High Priority):**
    *   **Problem**: The `sandbox` attribute is used, but `allow-same-origin` combined with `allow-scripts` can potentially allow scripts in the iframe to access the parent frame if the origins match, which might be a security concern depending on the content being rendered.
    *   **Recommendation**: Carefully review the security implications of the `sandbox` attributes. If the content rendered in the iframe is untrusted or user-generated, consider removing `allow-same-origin` or implementing a more secure communication channel (e.g., `postMessage`) if interaction with the parent frame is required. If the origins are guaranteed to be different, `allow-same-origin` is less of a concern.
2.  **Improve React Component Execution in Iframe (High Priority):**
    *   **Problem**: The current method of injecting React code and relying on global `window` properties for component detection and rendering (`window.YourComponentName = YourComponentName;`) is fragile. It assumes the component is globally exposed and correctly named.
    *   **Recommendation**: Instead of relying on global `window` properties, consider a more robust and explicit way to pass and render React components within the iframe. This could involve:
        *   **Using `postMessage`**: The parent frame sends the component code (or a reference to it) to the iframe via `postMessage`. The iframe then dynamically loads and renders it.
        *   **Custom Webpack/Rollup build for sandbox**: If possible, create a separate build process for the sandbox content that bundles the React component and its dependencies, and then injects that bundled JavaScript into the iframe.
        *   **Dedicated React Renderer**: For highly controlled environments, a custom React renderer could be used, but this is a significant undertaking.
3.  **Refactor Duplicate Resize Logic (Medium Priority):**
    *   **Problem**: The resize handle logic is duplicated for both the `preview` and `code` tabs.
    *   **Recommendation**: Extract the resize handle `div` and its associated `onMouseDown` handler into a separate reusable component or a render prop. This will reduce code duplication and improve maintainability.
4.  **Enhance Error Handling in Iframe (Medium Priority):**
    *   **Problem**: Error messages displayed within the iframe are basic and might not provide enough detail for debugging. The `console.error` calls within the iframe's script are not conditionally logged.
    *   **Recommendation**:
        *   **Detailed Error Reporting**: Implement a mechanism to send detailed error information from the iframe back to the parent component (e.g., via `postMessage`) so that `DuckPondViewer` can display more informative error messages to the user or log them to a centralized error reporting service.
        *   **Conditional Logging in Sandbox**: Wrap `console.log` and `console.error` statements within `createReactSandbox` and `createJavaScriptSandbox` with `if (process.env.NODE_ENV === 'development')` to prevent them from appearing in production iframes.
5.  **Optimize Iframe Rendering Delay (Low Priority):**
    *   **Problem**: The `setTimeout` (50ms delay) before rendering the React component in the iframe is a heuristic and might not guarantee the DOM is fully ready, or could introduce unnecessary delay.
    *   **Recommendation**: Instead of a fixed `setTimeout`, consider using `iframe.onload` or a MutationObserver within the iframe to detect when the DOM is ready for rendering. This ensures the component is rendered as soon as possible without arbitrary delays.
6.  **Global `window` overrides in sandbox (High Priority):**
    *   **Problem**: Overriding `window.setTimeout`, `window.setInterval`, `window.requestAnimationFrame`, etc., within the sandbox is generally not recommended as it can interfere with the expected behavior of libraries or the browser itself.
    *   **Recommendation**: If these overrides are necessary for specific interactive components, ensure they are carefully managed and do not cause unintended side effects. Ideally, interactive components should be designed to work within the standard browser environment without requiring global overrides.
7.  **Externalize `getFileExtension` (Minor):**
    *   **Problem**: `getFileExtension` is a simple helper function defined within the same file.
    *   **Recommendation**: Move `getFileExtension` to a shared utility file (e.g., `utils.ts` or a new `file-utils.ts` in `lib`) if it's used elsewhere or could be reused in the future. This improves modularity.
8.  **Conditional Logging (throughout):**
    *   **Problem**: `console.log` and `console.error` statements are present without `process.env.NODE_ENV` checks.
    *   **Recommendation**: Wrap all `console.log` and `console.error` statements with `if (process.env.NODE_ENV === 'development')` to prevent them from appearing in production builds.
9.  **`updateExecution` Callback Stability (Medium Priority):**
    *   **Problem**: `updateExecution` is a `useCallback` that depends on `currentExecution`. If `currentExecution` changes frequently, `updateExecution` will be re-created, potentially causing issues if it's passed down to memoized children.
    *   **Recommendation**: Review the usage of `currentExecution` within `updateExecution`. If `updateExecution` only needs to update the state based on the *previous* state, it can use the functional form of `setExecution` without `currentExecution` in its dependency array.
10. **`useEffect` for `artifact.type === 'react-component'` (Medium Priority):**
    *   **Problem**: The `useEffect` that calls `handleExecute` for `react-component` types has `artifact.id`, `artifact.type`, `currentExecution.status`, and `handleExecute` as dependencies. This could lead to `handleExecute` being called multiple times unnecessarily.
    *   **Recommendation**: Ensure `handleExecute` is stable and that this `useEffect` only triggers execution once per artifact, or when a specific re-execution is desired. The `currentExecution.status === 'idle'` check helps, but ensure the overall flow is robust.
11. **Hardcoded Styles in Sandbox HTML (Minor):**
    *   **Problem**: Inline styles and hardcoded CSS are used within the sandbox HTML content (`createReactSandbox`, `createJavaScriptSandbox`, `handleStop`, `handleReset`).
    *   **Recommendation**: For more complex styling, consider injecting a `<style>` tag with CSS classes or linking to a small CSS file within the sandbox HTML. This improves maintainability and readability.

### `upload-history.tsx` - MEDIUM PRIORITY
**Issues:**
1.  **Duplicate Utility Functions**: `formatDistanceToNow`, `getFileIcon`, and `formatFileSize` are defined locally within the component, but `formatFileSize` is also imported from `@/types/file-upload`.
2.  **`window.confirm` for Deletion**: Using `window.confirm` for a critical action like deletion is generally discouraged in modern React applications.
3.  **Missing `useMemo` for Filtered/Sorted Uploads**: The `filteredUploads` array is re-calculated on every render without memoization.
4.  **Conditional Logging**: `console.error` statements are not conditionally wrapped with `process.env.NODE_ENV === 'development'`.
5.  **Direct DOM Manipulation for Download**: The `handleDownloadFile` function directly creates and manipulates an `<a>` tag for file download.

**Detailed Recommendations for `upload-history.tsx`:**
1.  **Centralize Utility Functions (Medium Priority):**
    *   **Problem**: `formatDistanceToNow`, `getFileIcon`, and `formatFileSize` are defined locally within the component, leading to code duplication and reduced reusability. `formatFileSize` is even duplicated (defined locally and imported).
    *   **Recommendation**: Move these utility functions to a shared `lib/utils.ts` or a new `lib/file-utils.ts` file. Import and use them consistently across the application. Remove the local definitions.
2.  **Replace `window.confirm` with Custom Dialog (Medium Priority):**
    *   **Problem**: Using `window.confirm` for deletion provides a poor user experience and lacks styling control. It also blocks the main thread.
    *   **Recommendation**: Implement a custom confirmation dialog (e.g., using `shadcn/ui`'s `AlertDialog` component, similar to what's used in `chat-header.tsx` for resetting models or deleting history). This provides a consistent and branded user experience.
3.  **Memoize Filtered and Sorted Uploads (Medium Priority):**
    *   **Problem**: The `filteredUploads` array is re-calculated on every render, even if the `uploads`, `searchQuery`, `sortBy`, or `filterType` haven't changed. This can lead to unnecessary re-renders and performance issues, especially with a large number of uploads.
    *   **Recommendation**: Wrap the `filteredUploads` calculation in a `useMemo` hook, with `uploads`, `searchQuery`, `sortBy`, and `filterType` as dependencies. This ensures the array is only re-calculated when these dependencies change.
4.  **Conditional Logging (Low Priority):**
    *   **Problem**: `console.error` statements are not conditionally wrapped with `process.env.NODE_ENV === 'development'`.
    *   **Recommendation**: Wrap all `console.error` statements with `if (process.env.NODE_ENV === 'development')` to prevent them from appearing in production builds.
5.  **Encapsulate File Download Logic (Minor):**
    *   **Problem**: The `handleDownloadFile` function directly creates and manipulates an `<a>` tag for file download. While functional, this is a direct DOM manipulation within a React component.
    *   **Recommendation**: Consider creating a dedicated utility function (e.g., `downloadFile(url, filename)`) in `lib/file-utils.ts` that encapsulates this DOM manipulation. This keeps the component cleaner and makes the download logic reusable.
6.  **`handlePreviewFile` URL Generation (Minor):**
    *   **Problem**: `handlePreviewFile` relies on `upload.url` being present. If it's not, it provides a generic error. It doesn't attempt to generate a signed URL on the fly if `upload.url` is missing, unlike `file-preview.tsx`.
    *   **Recommendation**: If `upload.url` is not available, `handlePreviewFile` should attempt to generate a signed URL using `FileUploadService.getFileUrl(upload.storage_path)` before opening the window, similar to `file-preview.tsx`.
7.  **Type Consistency for `checked` in Checkbox Handlers (Minor):**
    *   **Problem**: `onCheckedChange` for `Checkbox` can return `boolean | string`. The handlers `handleSelectUpload` and `handleSelectAll` cast `checked as boolean`.
    *   **Recommendation**: Ensure the `Checkbox` component's `onCheckedChange` prop is typed to consistently return a boolean, or handle the `string` case explicitly if it's a valid scenario (e.g., for indeterminate states).
8.  **Accessibility (Minor):**
    *   **Problem**: Ensure the search input, selects, and checkboxes are fully accessible, including keyboard navigation and ARIA attributes.
    *   **Recommendation**: Perform an accessibility audit for the upload history component.

### `usage-summary.tsx` - CLEAN
**Issues:** None.

**Detailed Recommendations for `usage-summary.tsx`:**
This component is simple and appears to be clean. It effectively displays usage data. No specific recommendations.

### `alert-dialog.tsx` - CLEAN
**Issues:** None.

**Detailed Recommendations for `alert-dialog.tsx`:**
This file is a direct re-export and styling of Radix UI's `AlertDialog` components, following the `shadcn/ui` pattern. It is clean and well-structured for its purpose. No specific recommendations.

### `avatar.tsx` - CLEAN
**Issues:** None.

**Detailed Recommendations for `avatar.tsx`:**
This file is a direct re-export and styling of Radix UI's `Avatar` components, following the `shadcn/ui` pattern. It is clean and well-structured for its purpose. No specific recommendations.

### `badge.tsx` - CLEAN
**Issues:** None.

**Detailed Recommendations for `badge.tsx`:**
This file is a simple wrapper around `cva` for creating styled badges, following the `shadcn/ui` pattern. It appears to be clean and well-structured for its purpose. No specific recommendations.

### `button.tsx` - CLEAN
**Issues:** None.

**Detailed Recommendations for `button.tsx`:**
This file is a direct re-export and styling of Radix UI's `Slot` component and a standard HTML `button` element, using `cva` for styling, following the `shadcn/ui` pattern. It is clean and well-structured for its purpose. No specific recommendations.

### `card.tsx` - CLEAN
**Issues:** None.

**Detailed Recommendations for `card.tsx`:**
This file is a simple wrapper around `div` elements for creating styled cards, following the `shadcn/ui` pattern. It is clean and well-structured for its purpose. No specific recommendations.

### `checkbox.tsx` - CLEAN
**Issues:** None.

**Detailed Recommendations for `checkbox.tsx`:**
This file is a direct re-export and styling of Radix UI's `Checkbox` component, following the `shadcn/ui` pattern. It is clean and well-structured for its purpose. No specific recommendations.

### `dialog.tsx` - CLEAN
**Issues:** None.

**Detailed Recommendations for `dialog.tsx`:**
This file is a direct re-export and styling of Radix UI's `Dialog` components, following the `shadcn/ui` pattern. It is clean and well-structured for its purpose. No specific recommendations.

### `dropdown-menu.tsx` - CLEAN
**Issues:** None.

**Detailed Recommendations for `dropdown-menu.tsx`:**
This file is a direct re-export and styling of Radix UI's `DropdownMenu` components, following the `shadcn/ui` pattern. It is clean and well-structured for its purpose. No specific recommendations.

### `input.tsx` - CLEAN
**Issues:** None.

**Detailed Recommendations for `input.tsx`:**
This file is a simple wrapper around a standard HTML `input` element, applying styles and forwarding refs, following the `shadcn/ui` pattern. It is clean and well-structured for its purpose. No specific recommendations.

### `label.tsx` - CLEAN
**Issues:** None.

**Detailed Recommendations for `label.tsx`:**
This file is a simple wrapper around Radix UI's `Label` component, applying styles and forwarding refs, following the `shadcn/ui` pattern. It is clean and well-structured for its purpose. No specific recommendations.

### `popover.tsx` - CLEAN
**Issues:** None.

**Detailed Recommendations for `popover.tsx`:**
This file is a direct re-export and styling of Radix UI's `Popover` components, applying styles and forwarding refs, following the `shadcn/ui` pattern. It is clean and well-structured for its purpose. No specific recommendations.

### `progress.tsx` - CLEAN
**Issues:** None.

**Detailed Recommendations for `progress.tsx`:**
This file is a direct re-export and styling of Radix UI's `Progress` component, applying styles and forwarding refs, following the `shadcn/ui` pattern. It is clean and well-structured for its purpose. No specific recommendations.

### `scroll-area.tsx` - CLEAN
**Issues:** None.

**Detailed Recommendations for `scroll-area.tsx`:**
This file is a simple wrapper around `div` elements for creating scrollable areas, applying styles and forwarding refs, following the `shadcn/ui` pattern. It is clean and well-structured for its purpose. No specific recommendations.

### `select.tsx` - CLEAN
**Issues:** None.

**Detailed Recommendations for `select.tsx`:**
This file is a direct re-export and styling of Radix UI's `Select` components, applying styles and forwarding refs, following the `shadcn/ui` pattern. It is clean and well-structured for its purpose. No specific recommendations.

### `separator.tsx` - CLEAN
**Issues:** None.

**Detailed Recommendations for `separator.tsx`:**
This file is a simple wrapper around a `div` element for creating styled separators, following the `shadcn/ui` pattern. It is clean and well-structured for its purpose. No specific recommendations.

### `slider.tsx` - CLEAN
**Issues:** None.

**Detailed Recommendations for `slider.tsx`:**
This file is a direct re-export and styling of Radix UI's `Slider` component, applying styles and forwarding refs, following the `shadcn/ui` pattern. It is clean and well-structured for its purpose. No specific recommendations.

### `switch.tsx` - CLEAN
**Issues:** None.

**Detailed Recommendations for `switch.tsx`:**
This file is a direct re-export and styling of Radix UI's `Switch` component, applying styles and forwarding refs, following the `shadcn/ui` pattern. It is clean and well-structured for its purpose. No specific recommendations.

### `tabs.tsx` - CLEAN
**Issues:** None.

**Detailed Recommendations for `tabs.tsx`:**
This file is a direct re-export and styling of Radix UI's `Tabs` components, following the `shadcn/ui` pattern. It is clean and well-structured for its purpose. No specific recommendations.

### `textarea.tsx` - CLEAN
**Issues:** None.

**Detailed Recommendations for `textarea.tsx`:**
This file is a simple wrapper around a standard HTML `textarea` element, applying styles and forwarding refs, following the `shadcn/ui` pattern. It is clean and well-structured for its purpose. No specific recommendations.