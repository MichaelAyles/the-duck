# 🦆 The Duck - Quack-tastic AI Conversations

A modern, friendly, and performant LLM chat interface with personalized experiences and model flexibility. Ready to make waves in your AI conversations!

![The Duck Logo](public/duck-favicon.svg)

## ✨ Features

🎯 **Multi-Model Support** - OpenRouter integration with curated model selection  
💬 **Real-time Streaming** - Server-Sent Events for live AI responses  
🎨 **Beautiful UI** - Modern design with duck-themed styling and dark/light modes  
💾 **Chat Persistence** - Supabase integration for conversation history  
📊 **Smart Summaries** - AI-powered conversation analysis and insights  
🔒 **Type-Safe** - Full TypeScript coverage with Drizzle ORM  
⚡ **Performance** - Optimized builds with modern bundling  
🛡️ **Secure** - Environment validation and security headers  

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- PostgreSQL database (or Supabase account)
- OpenRouter API key

### 1. Clone & Install
```bash
git clone <repository-url>
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
- `DATABASE_URL` - PostgreSQL connection string
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous key

### 3. Database Setup
```bash
# Generate and run migrations
npm run db:generate
npm run db:migrate

# Optional: Open database studio
npm run db:studio
```

### 4. Start Development
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
- **UI**: Tailwind CSS, shadcn/ui, Radix UI
- **Database**: Supabase PostgreSQL, Drizzle ORM
- **AI**: OpenRouter API with multiple model support
- **Deployment**: Vercel-ready configuration

### Project Structure
```
src/
├── app/                    # Next.js App Router
├── components/             # React components
│   ├── chat/              # Chat interface components
│   └── ui/                # Reusable UI components
├── hooks/                 # Custom React hooks
├── lib/                   # Utilities and services
│   ├── db/                # Database schema and operations
│   └── env.ts             # Environment validation
└── types/                 # TypeScript type definitions
```

## 🦆 Duck Features

### Special Duck Mode
Activate "Duck Mode" for a quack-tastic conversation experience where responses are translated into duck speak! Perfect for fun conversations.

### Duck-Themed UI
- Custom duck gradients and shadows
- Animated duck logo
- Wave patterns and water-themed styling
- Smooth hover effects with "duck glow"

## 🔧 Configuration

### Model Selection
The Duck supports multiple AI models through OpenRouter:
- GPT-4 variants for premium conversations
- Claude models for creative writing
- Specialized models for coding and analysis

### Theme System
- **Light Mode**: Clean and bright duck pond aesthetic
- **Dark Mode**: Peaceful nighttime water vibes
- **System**: Automatically matches your OS preference

### Chat Persistence
- Automatic conversation saving to Supabase
- Smart summarization after chat completion
- Writing style analysis for personalized experiences

## 🚀 Deployment

### Vercel Deployment
1. Push your code to GitHub
2. Connect repository to Vercel
3. Add environment variables in Vercel dashboard
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

## 🤝 Contributing

We welcome contributions to make The Duck even more quack-tastic! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

## 🦆 About The Duck

The Duck started as "Aura Chat" and evolved into a friendly, approachable AI assistant that makes conversations feel natural and fun. Whether you're tackling complex problems or just want to chat, The Duck is here to help you navigate the waters of AI interaction.

**Ready to dive in?** Start chatting with The Duck today! 🌊
