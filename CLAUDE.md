# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Building and Running
```bash
npm run dev              # Start development server on port 12000
npm run build            # Create production build
npm run start            # Start production server on port 12000
```

### Code Quality Workflow
**IMPORTANT**: After implementing any feature or completing a task from todo.md:
```bash
npm run workflow         # Runs build + lint:fix + type-check
```
This command must pass before committing. It runs:
1. Production build validation
2. Automatic linting fixes
3. TypeScript type checking

### Testing
```bash
npm test                 # Run all tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Generate coverage report
```

### Linting and Type Checking
```bash
npm run lint             # Check for linting issues
npm run lint:fix         # Auto-fix linting issues
npm run type-check       # TypeScript type validation
```

## High-Level Architecture

### Tech Stack
- **Framework**: Next.js 15 with App Router (React 19)
- **Language**: TypeScript (strict mode)
- **Database**: Supabase (PostgreSQL with Row-Level Security)
- **Caching**: Upstash Redis (serverless)
- **Authentication**: Supabase Auth (OAuth)
- **AI**: OpenRouter API for LLM access
- **UI**: Tailwind CSS + shadcn/ui components

### Core Architectural Patterns

#### 1. Server-Side API Architecture
All database operations go through authenticated API routes (`/api/*`). Client components never directly access the database.

```typescript
// ✅ Correct: API route handles database
// src/app/api/sessions/route.ts
export async function POST(request: Request) {
  const user = await authenticateUser()
  const data = await request.json()
  return createSession(user.id, data)
}

// ❌ Never: Direct database access from client
// This pattern is NOT used in this codebase
```

#### 2. Modular Hook Pattern
Business logic is encapsulated in custom hooks that the main `ChatLayout` component orchestrates:

- `useChatSession`: Session lifecycle and message loading
- `useMessageHandling`: Message sending and streaming
- `useChatSettings`: User preferences and model selection
- `useChatLifecycle`: Chat ending and cleanup
- `useArtifacts`: DuckPond interactive content management

#### 3. Append-Only Message Architecture
Messages use an append-only pattern to prevent data loss:
- New messages are always inserted, never updated
- Message IDs are immutable UUIDs
- Streaming updates create new message versions

#### 4. Real-time Streaming
Server-Sent Events (SSE) for streaming AI responses:
```typescript
// API returns text/event-stream for real-time updates
response.headers.set('Content-Type', 'text/event-stream')
```

### Key Services and Utilities

#### Chat Service (`lib/chat-service.ts`)
Central service for chat operations:
- Message persistence
- Session management
- Title generation
- Flow mode summaries

#### Artifact Service (`lib/artifact-service.ts`)
Manages DuckPond interactive artifacts:
- Detects `<duckpond>` tags in messages
- Stores artifact content
- Handles artifact execution

#### Security (`lib/security.ts`)
Rate limiting and protection:
- Redis-based distributed rate limiting
- IP-based and user-based limits
- Configurable per endpoint

## Important Patterns to Follow

### Error Handling
Always use toast notifications for user-facing errors:
```typescript
import { useToast } from "@/hooks/use-toast"

const { toast } = useToast()
toast({
  title: "Error",
  description: "User-friendly message",
  variant: "destructive"
})
```

### Authentication Checks
Every API route must verify authentication:
```typescript
import { createServerClient } from '@/lib/supabase/server'

const supabase = await createServerClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
```

### Type Safety
Always define TypeScript interfaces:
```typescript
// Define types in src/types/
interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}
```

## Working with todo.md

The project uses todo.md for task tracking. After completing any task:

1. Mark the task as complete in todo.md
2. Run `npm run workflow` to validate changes
3. If workflow passes, commit to a feature branch (not main)
4. Push to GitHub and verify GitHub Actions pass
5. Create a pull request when ready

## Key File Locations

- **API Routes**: `src/app/api/`
- **React Components**: `src/components/`
- **Custom Hooks**: `src/hooks/`
- **Services/Utilities**: `src/lib/`
- **Type Definitions**: `src/types/`
- **Database Migrations**: `sql/`
- **Configuration**: `next.config.ts`, `tailwind.config.ts`

## Environment Variables Required

```env
OPENROUTER_API_KEY=          # OpenRouter API key
NEXT_PUBLIC_SUPABASE_URL=    # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY= # Supabase anonymous key
NEXT_PUBLIC_APP_URL=         # Application URL (http://localhost:12000 for dev)
UPSTASH_REDIS_REST_URL=     # Redis REST URL
UPSTASH_REDIS_REST_TOKEN=   # Redis auth token
```

## CircuitJS1 Circuit Simulation

The Duck now supports interactive electronic circuit simulations using CircuitJS1. When users request circuit simulations, wrap netlists in `<circuit>` or `<circuitjs>` tags.

### Basic Usage

```xml
<circuit title="RC Filter" description="Low-pass RC filter demonstration">
$ 1 0.000005 10.20027730826997 50 5 43 5e-11
r 176 80 384 80 0 1000
c 384 352 176 352 4 0.000001 0 0
w 176 80 176 352 0
v 448 352 448 80 0 0 40 5 0 0 0.5
g 176 352 0
o 4 64 0 4099 20 0.05 0 2 4 3
</circuit>
```

### Complete CircuitJS1 Component Reference

All components follow the pattern: `componentcode x1 y1 x2 y2 flags param1 param2...`

#### Basic Passive Components

**Resistor** - Code: 'r'
- Syntax: `r x1 y1 x2 y2 flags resistance`
- Example: `r 100 100 200 100 0 1000` (1kΩ resistor)

**Capacitor** - Code: 'c'
- Syntax: `c x1 y1 x2 y2 flags capacitance voltdiff initialVoltage`
- Example: `c 100 100 200 100 0 1e-6 0 0` (1µF capacitor)

**Polar Capacitor** - Code: 209
- Syntax: `209 x1 y1 x2 y2 flags capacitance voltdiff initialVoltage`

**Inductor** - Code: 'l'
- Syntax: `l x1 y1 x2 y2 flags inductance current`
- Example: `l 100 100 200 100 0 0.001 0` (1mH inductor)

**Potentiometer** - Code: 174
- Syntax: `174 x1 y1 x2 y2 flags maxResistance position sliderText`

**Memristor** - Code: 'm'
- Syntax: `m x1 y1 x2 y2 flags resistance r_on r_off state_on dopeWidth d_pos initState`

#### Power Sources

**Voltage Source** - Code: 'v'
- Syntax: `v x1 y1 x2 y2 flags waveform frequency maxVoltage bias phaseShift dutyCycle`
- Waveforms: 0=DC, 1=AC, 2=Square, 3=Triangle, 4=Sawtooth, 5=Pulse, 6=Noise
- Example: `v 100 100 100 200 0 0 40 5 0 0 0.5` (5V DC source)

**Current Source** - Code: 'i'
- Syntax: `i x1 y1 x2 y2 flags current`
- Example: `i 100 100 200 100 0 0.001` (1mA current source)

**Rail** - Code: 'R'
- Syntax: `R x1 y1 x2 y2 flags voltage`
- Example: `R 100 100 200 100 0 5` (5V rail)

#### Semiconductors

**Diode** - Code: 'd'
- Syntax: `d x1 y1 x2 y2 flags fwdrop model_name`
- Example: `d 100 100 200 100 0 0.7 default`

**Zener Diode** - Code: 'z'
- Syntax: `z x1 y1 x2 y2 flags fwdrop zvoltage model_name`

**LED** - Code: 162
- Syntax: `162 x1 y1 x2 y2 flags fwdrop model_name colorR colorG colorB maxBrightnessCurrent`
- Example: `162 100 100 200 100 0 2.1 default-led 1 0 0 0.01` (Red LED)

**Transistor (NPN/PNP)** - Code: 't'
- Syntax: `t x1 y1 x2 y2 flags pnp lastvbe lastvbc beta model_name`
- Example: `t 100 100 200 200 0 1 0 0 100 default` (NPN with β=100)

**MOSFET** - Code: 'f'
- Syntax: `f x1 y1 x2 y2 flags pChannel lastVgs lastVds model_name threshold`

**JFET** - Code: 'j'
- Syntax: `j x1 y1 x2 y2 flags pChannel lastVgs lastVds beta threshold`

#### Logic Gates

**AND Gate** - Code: 150
- Syntax: `150 x1 y1 x2 y2 flags inputCount lastOutput highVoltage`
- Example: `150 100 100 200 100 0 2 0 5` (2-input AND gate)

**NAND Gate** - Code: 151
**OR Gate** - Code: 152  
**NOR Gate** - Code: 153
**XOR Gate** - Code: 154
**Inverter** - Code: 'I'

#### Flip-Flops and Memory

**D Flip-Flop** - Code: 155
- Syntax: `155 x1 y1 x2 y2 flags bits state0 state1 highVoltage`

**JK Flip-Flop** - Code: 156
**T Flip-Flop** - Code: 193
**Latch** - Code: 168
**Counter** - Code: 164
**SRAM** - Code: 413

#### Op-Amps and Analog ICs

**Op-Amp (Ideal)** - Code: 'a'
- Syntax: `a x1 y1 x2 y2 flags maxOut minOut gbw volts0 volts1 gain`
- Example: `a 100 100 200 200 0 15 -15 1e6 0 0 100000`

**Comparator** - Code: 401
**Timer (555)** - Code: 165
**VCO** - Code: 158

#### Controlled Sources

**VCVS** - Code: 212
**VCCS** - Code: 213
**CCVS** - Code: 214
**CCCS** - Code: 215

#### Transformers and Transmission Lines

**Transformer** - Code: 'T'
- Syntax: `T x1 y1 x2 y2 flags inductance ratio volts0 volts1 volts2 volts3`

**Transmission Line** - Code: 171
- Syntax: `171 x1 y1 x2 y2 flags delay impedance volts0 volts1 volts2 volts3`

#### Switches and Relays

**Switch (SPST)** - Code: 's'
- Syntax: `s x1 y1 x2 y2 flags position momentary`

**Switch (SPDT)** - Code: 'S'
**Analog Switch** - Code: 159
**Relay** - Code: 178

#### Measurement and I/O

**Probe** - Code: 'p'
**Scope** - Code: 403
**Logic Input** - Code: 'L'
**Logic Output** - Code: 'M'
**ADC** - Code: 167
**DAC** - Code: 166

#### Special Components

**Ground** - Code: 'g'
- Syntax: `g x1 y1 x2 y2 flags`

**Wire** - Code: 'w'
- Syntax: `w x1 y1 x2 y2 flags`

**Text** - Code: 'x'
- Syntax: `x x1 y1 x2 y2 flags size text`

### Circuit Design Guidelines

1. **Grid Alignment**: Use coordinates in multiples of 16 for clean layouts
2. **Component Spacing**: Maintain consistent spacing between components
3. **Power Connections**: Place voltage sources on the left, grounds at bottom
4. **Measurement Points**: Add probes and scopes to visualize key signals
5. **Documentation**: Use text labels to explain circuit operation

### Common Circuit Patterns

**RC Low-Pass Filter**:
```
$ 1 0.000005 10.20027730826997 50 5 43 5e-11
r 176 80 384 80 0 1000
c 384 352 176 352 4 0.000001 0 0
w 176 80 176 352 0
v 448 352 448 80 0 0 40 5 0 0 0.5
g 176 352 0
```

**LED Circuit**:
```
$ 1 0.000005 10.20027730826997 50 5 43 5e-11
v 100 100 100 200 0 0 40 5 0 0 0.5
r 100 100 200 100 0 330
162 200 100 200 200 0 2.1 default-led 1 0 0 0.01
w 100 200 200 200 0
g 200 200 0
```

**Op-Amp Buffer**:
```
$ 1 0.000005 10.20027730826997 50 5 43 5e-11
a 200 150 300 200 0 15 -15 1e6 0 0 100000
w 200 165 200 185 0
v 100 100 100 200 0 1 60 1 0 0 0.5
w 100 100 200 165 0
g 100 200 0
```

### Simulation Parameters

First line format: `$ 1 timestep maxtime flags range current`
- timestep: Simulation time step (typically 0.000005)
- maxtime: Maximum simulation time
- flags: Various simulation options
- range: Voltage range for display
- current: Current range for display

## Development Tips

1. **State Management**: Uses React hooks, not global state libraries
2. **Component Pattern**: Keep components "dumb", logic in hooks
3. **API First**: All data operations through API routes
4. **Type Everything**: TypeScript strict mode is enabled
5. **Test Coverage**: Run tests before committing
6. **Performance**: Use React.memo and useCallback for optimization