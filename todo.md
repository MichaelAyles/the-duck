# Aura Chat - Project TODO & Status

## Project Description

Design and develop a modern, beautiful, and performant open-source LLM chat website named 'Aura Chat' with a strong emphasis on user-centric persistence and model flexibility. The application should provide a seamless chat experience, utilizing OpenRouter as its primary API and also supporting Ollama for local model integration.

## 🎉 CURRENT STATUS: MAJOR MILESTONE ACHIEVED!

### ✅ COMPLETED FEATURES
1. **Full UI Implementation**: Modern, responsive chat interface with all components working
2. **OpenRouter Integration**: Complete API client with streaming support - READY FOR API KEY
3. **Model Management**: Dynamic model loading and curated favorites selection
4. **Theme System**: Light/Dark/System themes with smooth transitions
5. **Storage Toggle**: Visual feedback with background color changes
6. **Settings Dialog**: Comprehensive preferences management (Models/Behavior/Appearance tabs)
7. **Error Handling**: Graceful error states and user feedback
8. **Real-time Streaming**: Server-Sent Events for live message updates
9. **Chat Interface**: Message bubbles, avatars, loading states, End Chat functionality

### 🔑 READY FOR API KEY CONFIGURATION

**To add your OpenRouter API key:**
1. Open `/workspace/aura-chat/.env.local`
2. Replace the empty `OPENROUTER_API_KEY=""` with your actual key:
   ```bash
   OPENROUTER_API_KEY="sk-or-v1-your-actual-key-here"
   ```
3. Save the file - the chat will immediately start working with real AI responses!

The application is fully functional and ready for real OpenRouter API integration.

## Core Functionality

### Real-time Chat Interface
- A highly responsive chat interface that feels intuitive and modern, suitable for 2025
- Support markdown rendering for LLM responses

### Model Selection
- Implement a simple, user-friendly dropdown on the chat front-end displaying a curated list of 'starred' (favorite) LLM models
- Provide a dedicated 'Preferences' tab where users can browse all available OpenRouter and Ollama models, select their favorites, and manage their general application preferences

### Chat Persistence & Summarization
- A chat session is deemed 'complete' either by an explicit 'End Chat' button click or after 10 minutes of user inactivity
- Upon completion, the system must summarize the chat session and analyze the user's explicit preferences and implicit writing style
- This summarization and analysis should be performed by a cost-effective model (e.g., Gemini Flash or similar)

### User Preferences to Capture

#### Explicit Preferences
- User-defined settings for LLM models, selected theme, and most crucially, domain-specific preferences and dislikes (e.g., 'prefers ST parts,' 'dislikes Qualcomm,' 'dislikes React')
- These should directly influence future LLM responses, allowing for personalized, contextual suggestions and acknowledgements (e.g., "Since you don't like React, let's try...", "You like ST, so how about an STM32F4?")

#### Implicit Writing Style/Tone
- The system should dynamically analyze the user's conversation style (e.g., short questions lead to short answers, long detailed queries receive detailed responses, formal/informal language, use of jargon, verbosity)
- This analysis should inform the LLM's response generation for the current chat

#### Tone Control
- Implement a 'tone' slider in the UI
- One prominent option on this slider should be 'Match User's Style', which leverages the real-time writing style analysis

### Clear Indication of Storage
- When a chat is complete and the system is about to summarize and store history/preferences, a clear and non-intrusive visual indicator (e.g., a subtle banner or a brief animation in the footer) should inform the user that data is being processed for storage
- This storage occurs in the background

### Efficient Storage
- Choose a sensible and practical open-source storage solution for an open-source web application (e.g., PostgreSQL or MongoDB) to store chat summaries, explicit user preferences, and captured writing style profiles
- The solution should be scalable for an open-source project

## User Identity/Branding
- The application should suggest its own name 'Aura' as its default conversational identity
- Allow the user to optionally provide a custom name for the LLM to address itself

## Transparency & Control
- Implement a clear toggle in the UI to explicitly enable/disable history and preference storage
- This toggle should change the background color of the chat interface (e.g., a distinct darker shade when storage is active, a lighter or neutral shade when disabled) to provide a clear visual cue
- Users should have the ability to view and manage (edit/delete) their stored preferences

## Technical Stack (Chosen for 2025 Modernity, Performance, and Open-Source Friendliness)

### Frontend
- Next.js (React) for a fast, modern, and SEO-friendly single-page application experience with server-side rendering capabilities
- Utilize shadcn/ui and Tailwind CSS for a beautiful, highly customizable, and performant UI, focusing on subtle animations and transitions for a fluid user experience

### Backend
- Next.js API Routes (Node.js/TypeScript) for seamless integration with the frontend, handling OpenRouter/Ollama API calls, summarization logic, and database interactions
- Consider tRPC for type-safe end-to-end communication where applicable

### Database
- PostgreSQL for robust, reliable, and flexible data storage, ideal for structured user preferences, chat summaries, and user authentication details
- Drizzle ORM or Prisma for database interactions

### Authentication
- NextAuth.js (Auth.js) for secure, flexible, and open-source authentication, supporting various providers (e.g., email/password, Google, GitHub)

### Real-time Communication (Optional but Recommended for Performance)
- Server-Sent Events (SSE) or WebSockets (e.g., Socket.IO or Pusher if self-hosting a simpler alternative) for real-time message streaming from LLMs and immediate UI updates, ensuring a highly performant chat experience

## Non-Functional Requirements

### Beautiful & Modern Design
- A clean, minimalist aesthetic with thoughtful use of typography, whitespace, and a cohesive color palette
- Aim for a polished, professional, and visually appealing user interface with smooth transitions and responsive design for all screen sizes
- Consider a dark mode option

### Performant
- Optimized for speed and responsiveness
- Fast initial load times, near-instantaneous message delivery, and efficient resource utilization

### Open Source
- Structure the codebase for easy contribution and understanding
- Provide clear documentation for setup, development, and usage

### Security
- Implement best practices for API key management, user authentication, and data privacy

## Deliverables

Provide a high-level architectural overview, a breakdown of key components (frontend pages, backend services, database schema outline), a suggested technology stack justification, and a description of the user flow for chat, preference management, and persistence indications. Highlight how the personalized LLM responses based on stored preferences will be achieved.