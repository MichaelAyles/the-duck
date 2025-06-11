# 🦆 The Duck - Quack-tastic AI Conversations

A modern, friendly, and performant LLM chat interface with authentication, personalized experiences, and model flexibility.

![The Duck Logo](public/duck-favicon.svg)

**🌐 Live Demo**: [https://theduck.chat](https://theduck.chat)

## ✨ Features

-   **Multi-Model Support**: Connects to OpenRouter for a wide selection of LLMs.
-   **Secure Authentication**: User authentication via Supabase Auth (Google & GitHub OAuth).
-   **Real-time Streaming**: Server-Sent Events for live, streaming AI responses.
-   **Chat Persistence**: Saves conversation history to your Supabase database.
-   **Modern UI**: A polished, responsive interface built with Tailwind CSS and shadcn/ui.
-   **Dark/Light Mode**: User-selectable themes for comfort.
-   **Type-Safe**: Fully written in TypeScript.

## ⚠️ Important Security Note

This project is intended as a template and requires a **critical security refactor** before being used in production. The current architecture makes direct database calls from the client-side, which is a major security risk.

Please see the **`todo.md`** file for a prioritized list of tasks required to secure the application, starting with moving all database operations to server-side API routes.

## 🚀 Quick Start

### Prerequisites
-   Node.js 18+
-   A Supabase account (for database and authentication)
-   An OpenRouter API key

### 1. Clone & Install
```bash
git clone https://github.com/your-username/the-duck.git
cd the-duck
npm install
```

### 2. Environment Setup
Create a `.env.local` file by copying the example:
```bash
cp .env.example .env.local
```
Then, edit `.env.local` with your credentials:
-   `OPENROUTER_API_KEY`: Your key from [OpenRouter](https://openrouter.ai/keys).
-   `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL.
-   `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous key.
-   `NEXT_PUBLIC_APP_URL`: The deployment URL of your app (e.g., `http://localhost:12000` for local development or your Vercel URL).

### 3. Supabase Setup
You must run the migration script to set up your database tables and security policies.
1.  Go to your Supabase project dashboard.
2.  Navigate to the **SQL Editor**.
3.  Open `supabase_migration.sql` from this repository, copy its contents, and run it in the editor.

### 4. Run Development Server
```bash
# Start the development server
npm run dev
```
Open [http://localhost:12000](http://localhost:12000) to see The Duck in action!

## 🏗️ Architecture

### Tech Stack
-   **Framework**: Next.js 15, React 19, TypeScript
-   **UI**: Tailwind CSS, shadcn/ui, Radix UI
-   **Authentication**: Supabase Auth
-   **Database**: Supabase PostgreSQL
-   **AI**: OpenRouter API
-   **Deployment**: Vercel

### Project Structure (Current)
```
src/
├── app/              # Next.js App Router (Pages & API Routes)
├── components/       # React components
├── hooks/            # Custom React hooks
├── lib/              # Utilities, services, and configuration
│   └── db/           # (INSECURE) Direct DB operations
└── types/            # TypeScript type definitions
```
**Note**: The architecture needs to be refactored to move all logic from `src/lib/db/` into secure, server-side API routes within `src/app/api/`.

## 🔐 Security (Needs Improvement)

-   **Authentication**: Handled securely by Supabase.
-   **Authorization**: Currently relies on PostgreSQL Row-Level Security (RLS). While RLS is a necessary layer, it is **not sufficient** on its own when database logic is exposed to the client. The application must be refactored to use server-side API routes as the primary security boundary.
-   **Test Routes**: The codebase contains several test and debug API routes that should be removed before production deployment.

## 🚀 Deployment

This application can be deployed to Vercel. However, it is **strongly recommended** that you complete the security refactoring outlined in `todo.md` **before** deploying to a public environment.

1.  Push your code to a GitHub repository.
2.  Connect the repository to Vercel.
3.  Add the required environment variables in the Vercel project settings.
4.  Deploy.

## 📝 License

This project is licensed under the **GNU General Public License v3.0** (GPL-3.0). See the [LICENSE](LICENSE) file for full details.

## 🦆 About The Duck

The Duck started as "Aura Chat" and evolved into a friendly, approachable AI assistant that makes conversations feel natural and fun. With secure authentication, persistent chat history, and cross-device synchronization, The Duck provides a complete AI chat experience.

Whether you're tackling complex problems, brainstorming ideas, or just want to chat, The Duck is here to help you navigate the waters of AI interaction with style and security.

**Features that make The Duck special:**
- 🔐 **Secure Authentication**: Your conversations are private and persistent
- 🌊 **Duck Mode**: Unique quack-tastic conversation experience
- 🎨 **Beautiful Design**: Water-themed UI with smooth animations
- ⚡ **High Performance**: Optimized for speed and reliability
- 🔒 **Privacy-First**: Your data stays secure with RLS policies

**Ready to dive in?** Visit [theduck.chat](https://theduck.chat) and start chatting! 🌊
