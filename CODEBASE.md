# Codebase Documentation

This document provides a comprehensive overview of The Duck application, including its architecture, functionality, and a critical review of the current implementation.

## 1. Architecture Overview

The Duck is a modern web application built on the Next.js 15 App Router architecture. It serves as an AI-powered chat interface, enabling users to interact with various Large Language Models (LLMs) via the OpenRouter API.

### Tech Stack
-   **Framework**: Next.js 15 (React 19)
-   **Language**: TypeScript
-   **UI**: Tailwind CSS with shadcn/ui and Radix UI for accessible components.
-   **State Management**: React Context (`AuthProvider`) and modular hooks architecture.
-   **Authentication**: Supabase Auth (OAuth with Google/GitHub).
-   **Database**: Supabase PostgreSQL with Row-Level Security.
-   **AI Integration**: OpenRouter API for multi-model support.
-   **Real-time**: Server-Sent Events for streaming chat responses.

### Key Functional Components
-   **Client-Side**: The application uses a modular hook-based architecture with specialized hooks (`useChatSession`, `useMessageHandling`, `useChatSettings`, `useChatLifecycle`) for clean separation of concerns.
-   **Server-Side**: Secure Next.js API Routes handle all database operations, AI interactions, and user preferences. No direct database access from the client.
-   **Authentication Flow**: Supabase Auth with secure session management through middleware and RLS policies. All API routes verify authentication before operations.

## 2. Architecture Review

This section provides a critical analysis of the architectural decisions and implementation quality.

### The Good 🟢
-   **Modern Frontend**: Next.js 15 with App Router, React 19, and shadcn/ui for a performant, maintainable UI.
-   **Secure Architecture**: All database operations proxied through authenticated server-side API routes. No client-side database access.
-   **Modular Hook Architecture**: Clean separation of concerns with specialized hooks (`useChatSession`, `useMessageHandling`, etc.).
-   **Comprehensive Error Handling**: User-friendly toast notifications for all error scenarios.
-   **Feature-Rich**: Multi-model support, chat persistence, AI-powered summarization, learning preferences, and polished UX.
-   **Type Safety**: Complete TypeScript coverage with proper interfaces and no `any` types.
-   **Centralized Configuration**: All constants and defaults managed in a single config file.

### The Bad 🟡 (Resolved)
-   **✅ Redundant Dependencies**: Removed unused `next-auth` package and obsolete Drizzle ORM directory.
-   **✅ Overly Complex Component**: Refactored `ChatInterface` into modular hooks with clear responsibilities.
-   **✅ Hardcoded Values**: All configuration centralized in `/src/lib/config.ts`.
-   **✅ API Architecture**: Clear client-server boundary with all database operations on server-side.

### The Ugly 🔴 (All Resolved)
-   **✅ SECURITY FIXED: No Client-Side Database Access**: All database operations moved to secure server-side API routes with proper authentication.
-   **✅ Test Routes Removed**: All debug/test API routes removed from codebase.
-   **✅ Clean Codebase**: Removed redundant files, unused assets, and obsolete dependencies.

## 3. Current Issues & Priorities

### Critical Issues (P1.5)
1. **State Race Conditions**: Dual message update paths in `useMessageHandling` causing inconsistency
2. **Memory Leaks**: Missing cleanup functions in useEffect hooks with timers
3. **Performance**: Unnecessary re-renders and excessive dependencies in callbacks

### Completed Improvements
-   ✅ **Secure Architecture**: All database operations moved to server-side
-   ✅ **Clean Codebase**: Removed test routes, unused dependencies, redundant files
-   ✅ **Modular Architecture**: Refactored into specialized hooks
-   ✅ **Centralized Config**: All settings in `/src/lib/config.ts`
-   ✅ **Type Safety**: Complete TypeScript coverage

## 4. Detailed File Breakdown

This section provides an overview of key files and directories.

### Root Directory
-   `middleware.ts`: Applies security headers, handles CORS, and attempts to block access to sensitive test paths in production.
-   `next.config.ts`: Main Next.js configuration for performance, security headers, and image optimization.
-   `package.json`: Lists project dependencies and defines development scripts. The key dependencies are `next`, `react`, `@supabase/ssr`, and `lucide-react`.

### `src/app` Directory
-   `layout.tsx`: The root layout, setting up the HTML structure, theme provider, and global styles.
-   `page.tsx`: The application's entry point. It uses the `useAuth` hook to determine if a user is logged in, showing either the `LoginForm` or the main `ChatLayout`.
-   **`api/`**: Contains all server-side API routes. This directory is a mix of legitimate application endpoints (`/api/chat`) and insecure test endpoints (`/api/database-test`).

### `src/components` Directory
-   **`auth/`**: Contains components related to authentication.
    -   `auth-provider.tsx`: A critical component that uses React Context to provide session and user data throughout the app. It correctly handles loading states and checks if Supabase is configured.
    -   `login-form.tsx`: The UI for logging in via OAuth providers.
-   **`chat/`**: The core UI components for the chat functionality.
    -   `chat-layout.tsx`: Organizes the `ChatHistorySidebar` and `ChatInterface`.
    -   `chat-interface.tsx`: The main "smart" component that orchestrates the chat experience. **(Needs refactoring due to high complexity).**
    -   `chat-history-sidebar.tsx`: Displays past conversations and allows session management.
-   **`ui/`**: Reusable, low-level UI components from `shadcn/ui`.

### `src/hooks` Directory
-   `use-models.ts`: A custom hook for fetching and managing the list of available AI models.
-   `use-toast.ts`: A simple hook for displaying toast notifications.

### `src/lib` Directory
-   `chat-service.ts`: A client-side class intended to be an abstraction layer for chat logic. **(Needs major refactoring to remove direct database calls).**
-   `supabase.ts`: Initializes and exports the client-side Supabase client.
-   **`db/supabase-operations.ts`**: **This file is the source of the critical security vulnerability.** It contains functions that make direct database calls from the client. **All logic in this file must be moved to server-side API routes.**

### `sql` Directory
-   Contains SQL scripts for database migrations and RLS policies. The presence of `rls_policies.sql` shows that security was considered, but it's not a sufficient replacement for a secure server-side API.

## Root Directory

-   `middleware.ts`: This file contains the middleware for the Next.js application. It is responsible for processing incoming requests before they reach the page or API route. Its primary functions are to apply security headers, handle Cross-Origin Resource Sharing (CORS), and block access to sensitive paths in a production environment. It uses a `matcher` config to define the paths it runs on, and conditionally blocks routes like `/api/database-test` to enhance security.

-   `next.config.ts`: This is the main configuration file for the Next.js framework. It defines how the application is built and run. This file includes settings for performance optimizations (like `swcMinify`), security headers, image optimization (specifying allowed remote domains for user avatars), and custom redirects (e.g., redirecting `/login` to the root `/`).

-   `tailwind.config.ts`: This is the configuration file for Tailwind CSS. It defines the application's design system, including the color palette for light and dark themes, fonts, border radiuses, and custom animations. It uses the `tailwindcss-animate` plugin to add utility classes for CSS animations.

-   `postcss.config.mjs`: This file contains the configuration for PostCSS, a tool for transforming CSS with JavaScript plugins. It is configured to use `tailwindcss` and `autoprefixer`, which automatically adds vendor prefixes to CSS rules for better cross-browser compatibility.

-   `eslint.config.mjs`: This file configures ESLint, a static analysis tool for identifying and reporting on problematic patterns found in ECMAScript/JavaScript code. It helps maintain code quality and consistency across the codebase.

-   `tsconfig.json`: This is the configuration file for the TypeScript compiler. It specifies the root files and the compiler options required to compile the project, such as target JavaScript version, module system, and path aliases (`@/*`).

-   `README.md`: This file provides a general overview of the project, its purpose, and instructions on how to set it up and run it.

## `src/app` Directory

This directory contains the core application logic, including all pages, layouts, and API routes, following the Next.js App Router structure.

-   `page.tsx`: This is the main page component of the application, serving as the entry point for the user interface. It's a server component that checks for an active user session using Supabase authentication. If a user is logged in, it renders the `ChatInterface`; otherwise, it displays the `LoginForm`.

-   `layout.tsx`: This is the root layout of the application. It defines the main HTML structure (`<html>` and `<body>`) that is shared across all pages. It sets up the `Inter` font, wraps the application in a `ThemeProvider` for light/dark mode functionality, and includes the `Toaster` component for displaying global notifications.

-   `globals.css`: This file contains global CSS styles and Tailwind CSS directives. It's where the base styles, component styles, and utility styles from Tailwind are imported. It also defines CSS custom properties for theming, allowing for dynamic color changes between light and dark modes.

### `src/app/api` Directory

This directory contains secure API routes for server-side operations. All routes verify authentication before database access.

-   `chat/route.ts`: Main chat endpoint handling streaming AI responses. Validates authentication and rate limits.

-   `chat-history/route.ts`: Manages user's chat history - fetching and deleting sessions with proper authorization.

-   `generate-title/route.ts`: Auto-generates chat titles using AI summarization.

-   `learning-preferences/route.ts`: Manages user learning preferences for AI personalization.

-   `load-session/route.ts`: Loads specific chat session messages with authentication checks.

-   `models/route.ts`: Fetches available AI models from OpenRouter API.

-   `search-models/route.ts`: Provides model search functionality with caching.

-   `sessions/[sessionId]/route.ts`: RESTful API for individual session operations.

-   `sessions/route.ts`: Handles chat session creation and listing.

-   `starred-models/route.ts`: Manages user's starred/favorite models.

-   `summarize/route.ts`: Generates AI-powered chat summaries and preference analysis.

-   `user/preferences/route.ts`: Handles user preference management (theme, settings, etc.).

### `src/app/actions` Directory

This directory contains server-side actions that can be called directly from client components, a feature of the Next.js App Router.

-   `user.ts`: This file contains a server action for deleting a user's account and all associated data from the database.

### `src/app/auth` Directory

This directory contains authentication-related files and routes.

-   `callback/route.ts`: This API route handles the OAuth callback from Supabase. After a user authenticates with a third-party provider like Google or GitHub, they are redirected to this route, which exchanges the authentication code for a user session and then redirects them back to the application.

## `src/components` Directory

This directory contains all the React components used to build the application's user interface.

### `src/components/auth` Directory

-   `auth-provider.tsx`: This component uses React's Context API to provide authentication state (like the current user and session) to the entire application. It simplifies managing and accessing the user's authentication status in different components.

-   `login-form.tsx`: This component renders a login form that allows users to sign in using social providers (Google, GitHub) or with an email and password. It interacts with the Supabase client to handle the authentication process.

-   `user-menu.tsx`: This component displays a dropdown menu for logged-in users. It typically includes options to view their profile, log out, and delete their account.

### `src/components/chat` Directory

-   `chat-header.tsx`: This component renders the header section of the chat interface. It includes a dropdown for model selection, a settings dialog, and a switch to toggle between light and dark themes.

-   `chat-history-sidebar.tsx`: This component displays a sidebar containing the user's chat history. It allows users to view and switch between past conversations, create new chats, and search through their chat history.

-   `chat-input.tsx`: This component provides the text area and send button for users to type and send messages in the chat interface. It handles user input and triggers the `sendMessage` function.

-   `chat-interface.tsx`: This is the main component that orchestrates the entire chat experience. It manages the state of the chat messages, handles user settings, and uses the `useChat` hook to interact with the backend chat service.

-   `chat-layout.tsx`: This component defines the overall layout for the chat view, organizing the `ChatHistorySidebar` and the main `ChatInterface` into a cohesive structure.

-   `chat-messages.tsx`: This component is responsible for rendering the list of messages in a chat conversation. It iterates over the message array and uses the `MessageContent` component to display each one.

-   `message-content.tsx`: This component renders the content of a single chat message. It uses `react-markdown` to format messages written in Markdown, and includes syntax highlighting for code blocks.

-   `storage-indicator.tsx`: This component displays a visual indicator (like a spinning icon) to inform the user when their chat data is being saved or processed in the background.

### `src/components/ui` Directory

This directory contains reusable, low-level UI components, often built on top of a headless UI library like Radix UI and styled with Tailwind CSS.

-   `avatar.tsx`: A component for displaying user avatars or profile pictures.
-   `button.tsx`: A flexible and customizable button component with different variants (e.g., primary, secondary, destructive).
-   `card.tsx`: A container component with a card-like style, used for grouping and displaying content.
-   `dialog.tsx`: A component for creating modal dialogs or pop-ups.
-   `dropdown-menu.tsx`: A component for creating dropdown menus with various options.
-   `input.tsx`: A styled, standard HTML input field component.
-   `label.tsx`: A component for labeling form elements to improve accessibility.
-   `scroll-area.tsx`: A component that provides a styled, scrollable container for content.
-   `select.tsx`: A customizable `select` or dropdown component for choosing from a list of options.
-   `separator.tsx`: A component for rendering a horizontal or vertical line to visually separate content.
-   `slider.tsx`: A component that allows users to select a value from a continuous range.
-   `switch.tsx`: A toggle switch component for turning a setting on or off.
-   `tabs.tsx`: A component for creating tabbed interfaces to organize content.
-   `textarea.tsx`: A styled, resizable textarea component for multi-line text input.
-   `toast.tsx`: A component for displaying small, non-interruptive notifications (toasts).
-   `toaster.tsx`: A component that manages the rendering and positioning of multiple toasts.

-   `duck-logo.tsx`: A simple component that displays the application's SVG logo.
-   `theme-provider.tsx`: A component that manages the application's theme (light/dark mode) and persists the user's choice.

## `src/hooks` Directory

This directory contains custom React hooks following a modular architecture pattern.

-   `use-chat-session.ts`: Manages session state, message loading, and welcome messages
-   `use-message-handling.ts`: Handles message sending, streaming responses, and error management
-   `use-chat-settings.ts`: Manages user settings, model preferences, and configuration changes
-   `use-chat-lifecycle.ts`: Handles chat ending, inactivity detection, and cleanup operations
-   `use-learning-preferences.ts`: Manages user learning preferences and AI personalization
-   `use-models.ts`: Fetches and manages available AI models from OpenRouter
-   `use-starred-models.ts`: Manages user's starred/favorite models
-   `use-model-search.ts`: Provides debounced search functionality for model selection
-   `use-toast.ts`: Simple toast notification system

## `src/lib` Directory

This directory contains library code, utility functions, and services that are not specific to any single component.

-   `auth-config.ts`: This file centralizes authentication-related configuration, such as the Supabase URL, anonymous key, and OAuth redirect URLs, making them easy to manage and access.

-   `chat-service.ts`: This service class encapsulates the business logic for managing chat sessions. It handles saving and loading chat messages, generating titles, and summarizing conversations by interacting with the database and AI models.

-   `env.ts`: This file uses the Zod library to validate environment variables at runtime. It ensures that all required variables are present and correctly formatted, throwing an error if the configuration is invalid.

-   `openrouter.ts`: This file contains a client class for interacting with the OpenRouter API. It provides methods for fetching the list of available models and for making streaming and non-streaming chat completion requests.

-   `performance.ts`: This file includes a set of utilities for monitoring and optimizing the application's performance. It contains tools for measuring component render times, analyzing bundle size, and reporting performance metrics.

-   `security.ts`: This file contains critical security-related utilities and middleware. It provides functions for rate limiting, input validation and sanitization, and API key security to protect the application from common threats.

-   `streaming-optimizer.ts`: This file provides utilities for optimizing and managing streaming data from the server, ensuring a smooth and responsive user experience during chat conversations.

-   `supabase.ts`: This file initializes and exports the main Supabase client for the application. It includes a fallback to a mock client in the development environment if Supabase credentials are not provided, allowing the app to run without a database connection.

-   `utils.ts`: This file contains general-purpose utility functions. Its most common function is `cn`, which merges CSS classes from Tailwind CSS and `clsx` to conditionally apply styles.

### `src/lib/db` Directory

-   `server-operations.ts`: Server-side only database operations with proper authentication checks. All database interactions are performed through secure server-side API routes, never from the client.

### `src/lib/supabase` Directory

-   `server.ts`: This file provides a factory function for creating a Supabase client specifically for use on the server-side, such as in Server Components, API routes, and Server Actions. It is configured to handle cookies for authentication.

## `src/types` Directory

This directory contains TypeScript type definitions and interfaces used throughout the application to ensure type safety.

-   `chat.ts`: This file defines the core data structures related to the chat functionality, such as the `ChatMessage`, `ChatSession`, and `OpenRouterModel` interfaces.
-   `supabase.ts`: This file contains the TypeScript types that are automatically generated from the Supabase database schema. This ensures that any interaction with the database is type-safe.

## `sql` Directory

This directory contains raw SQL scripts for database migrations, schema setup, and defining security policies.

-   `add_user_id_column.sql`: This migration script adds a `user_id` column to the `chat_sessions` table to associate chats with specific users, and it updates the Row-Level Security (RLS) policies to use this new column for access control.
-   `performance_indexes.sql`: This file is intended to hold SQL commands for creating database indexes to improve query performance, although it is currently empty.
-   `rls_policies.sql`: This script defines the comprehensive Row-Level Security (RLS) policies for all database tables, ensuring that users can only access and modify their own data.

## `scripts` Directory

This directory contains utility scripts for aiding development.

-   `dev-setup.js`: This is an interactive Node.js script that helps developers set up their local environment. It checks for required environment variables, verifies that necessary dependencies are installed, and can help create the initial `.env.local` file.

## Removed Directories

### `drizzle` Directory (Removed)
Previously contained Drizzle ORM migration files. Removed as the project uses direct Supabase SQL queries.

### `database` Directory (Removed)
Contained duplicate migration files. Consolidated into the main SQL migration script. 