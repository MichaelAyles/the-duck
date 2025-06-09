# 🦆 The Duck - Quack-tastic AI Conversations

A modern, friendly, and performant LLM chat interface with authentication, personalized experiences, and model flexibility. Ready to make waves in your AI conversations!

![The Duck Logo](public/duck-favicon.svg)

**🌐 Live Demo**: [https://theduck.chat](https://theduck.chat) | [https://the-duck-seven.vercel.app](https://the-duck-seven.vercel.app)

## ✨ Features

🎯 **Multi-Model Support** - OpenRouter integration with curated model selection  
🔐 **Authentication** - Google & GitHub OAuth with Supabase Auth  
💬 **Real-time Streaming** - Server-Sent Events for live AI responses  
🎨 **Beautiful UI** - Modern design with duck-themed styling and dark/light modes  
💾 **Chat Persistence** - User-specific conversation history with Supabase  
📊 **Smart Summaries** - AI-powered conversation analysis and insights  
🔒 **Type-Safe** - Full TypeScript coverage with Drizzle ORM  
⚡ **Performance** - Optimized builds with modern bundling  
🛡️ **Secure** - Environment validation, RLS policies, and security headers  
🌊 **Duck Mode** - Quack-tastic conversation experience!

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- Supabase account (for database and authentication)
- OpenRouter API key

### 1. Clone & Install
```bash
git clone https://github.com/your-username/the-duck.git
cd the-duck
npm install
```

### 2. Environment Setup
```bash
# Copy the example environment file
cp .env.example .env.local

# Edit .env.local with your actual credentials
```

Required environment variables:
- `OPENROUTER_API_KEY` - Get from [OpenRouter](https://openrouter.ai/keys)
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous key
- `DATABASE_URL` - PostgreSQL connection string (for direct database operations)
- `NEXT_PUBLIC_APP_URL` - Your app URL (for OAuth redirects)

### 3. Supabase Setup

#### Database Setup
```bash
# Generate and run migrations
npm run db:generate
npm run db:migrate

# Optional: Open database studio
npm run db:studio
```

#### Authentication Setup
1. Go to your Supabase project dashboard
2. Navigate to Authentication > Providers
3. Enable Google and GitHub OAuth providers
4. Add your OAuth app credentials
5. Set redirect URLs to: `https://your-domain.com/auth/callback`

### 4. OAuth Provider Setup

#### GitHub OAuth App
1. Go to GitHub Settings > Developer settings > OAuth Apps
2. Create new OAuth App with:
   - **Homepage URL**: `https://your-domain.com`
   - **Authorization callback URL**: `https://your-domain.com/auth/callback`
3. Copy Client ID and Client Secret to Supabase

#### Google OAuth App
1. Go to Google Cloud Console > APIs & Services > Credentials
2. Create OAuth 2.0 Client ID with:
   - **Authorized redirect URIs**: `https://your-domain.com/auth/callback`
3. Copy Client ID and Client Secret to Supabase

### 5. Start Development
```bash
# Verify your setup
npm run setup

# Start the development server
npm run dev
```

Open [http://localhost:12000](http://localhost:12000) to see The Duck in action! 🦆

## 🛠️ Development Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server on port 12000 |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run setup` | Validate environment and setup |
| `npm run check-env` | Check environment configuration |
| `npm run type-check` | Run TypeScript type checking |
| `npm run lint` | Run ESLint |
| `npm run db:generate` | Generate database migrations |
| `npm run db:migrate` | Run database migrations |
| `npm run db:studio` | Open Drizzle Studio |

## 🏗️ Architecture

### Tech Stack
- **Frontend**: Next.js 15, React 19, TypeScript
- **Authentication**: Supabase Auth with OAuth (Google, GitHub)
- **UI**: Tailwind CSS, shadcn/ui, Radix UI
- **Database**: Supabase PostgreSQL, Drizzle ORM
- **AI**: OpenRouter API with multiple model support
- **Deployment**: Vercel with automatic deployments

### Project Structure
```
src/
├── app/                    # Next.js App Router
│   ├── auth/              # Authentication routes
│   └── api/               # API routes
├── components/             # React components
│   ├── auth/              # Authentication components
│   ├── chat/              # Chat interface components
│   └── ui/                # Reusable UI components
├── hooks/                 # Custom React hooks
├── lib/                   # Utilities and services
│   ├── db/                # Database schema and operations
│   └── env.ts             # Environment validation
└── types/                 # TypeScript type definitions
```

## 🔐 Authentication & Security

### User Authentication
- **OAuth Providers**: Google and GitHub integration
- **Session Management**: Secure JWT tokens with Supabase
- **Route Protection**: Automatic redirects for unauthenticated users
- **User Profiles**: Persistent user data and preferences

### Security Features
- **Row Level Security (RLS)**: Database-level access control
- **Input Validation**: Comprehensive request validation
- **Rate Limiting**: API endpoint protection
- **CORS Protection**: Secure cross-origin requests
- **Environment Validation**: Runtime configuration checks

## 🦆 Duck Features

### Special Duck Mode
Activate "Duck Mode" for a quack-tastic conversation experience where responses are translated into duck speak! Perfect for fun conversations.

### Duck-Themed UI
- Custom duck gradients and shadows
- Animated duck logo with hover effects
- Wave patterns and water-themed styling
- Smooth transitions with "duck glow"

### User Experience
- **Persistent Chat History**: All conversations saved per user
- **Cross-Device Sync**: Access your chats from anywhere
- **Smart Summaries**: AI-powered conversation insights
- **Personalized Settings**: Custom preferences and themes

## 🚀 Deployment

### Vercel Deployment (Recommended)
1. Push your code to GitHub
2. Connect repository to Vercel
3. Add environment variables in Vercel dashboard:
   ```
   OPENROUTER_API_KEY=your_openrouter_key
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres
   NEXT_PUBLIC_APP_URL=https://your-domain.com
   ```
4. Deploy! 🎉

### Manual Deployment
```bash
npm run build
npm run start
```

## 🧪 Testing

Test database operations:
```bash
# Start development server
npm run dev

# Test database connectivity
curl http://localhost:12000/api/database-test

# Test chat functionality
curl -X POST http://localhost:12000/api/database-test
```

Test authentication:
```bash
# Visit the app and try logging in with Google/GitHub
# Check browser network tab for auth flow
```

## 🤝 Contributing

We welcome contributions to make The Duck even more quack-tastic! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly (including authentication flows)
5. Submit a pull request

### Development Guidelines
- Follow TypeScript best practices
- Test authentication flows before submitting
- Ensure database migrations are included
- Update documentation for new features

## 📝 License

This project is licensed under the **GNU General Public License v3.0** (GPL-3.0).

This means:
- ✅ You can use, modify, and distribute this software
- ✅ You can use it for commercial purposes
- ⚠️ Any derivative work must also be licensed under GPL-3.0
- ⚠️ You must include the original license and copyright notice
- ⚠️ You must disclose the source code of any distributed modifications

See the [LICENSE](LICENSE) file for full details.

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
