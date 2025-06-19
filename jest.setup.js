require('@testing-library/jest-dom')

// Mock Next.js components and hooks
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
    has: jest.fn(),
    getAll: jest.fn(),
    keys: jest.fn(),
    values: jest.fn(),
    entries: jest.fn(),
    forEach: jest.fn(),
    toString: jest.fn(),
  }),
  usePathname: () => '/',
}))

// Mock Next.js server components  
jest.mock('next/server', () => ({
  NextRequest: class MockNextRequest {
    constructor(input, init) {
      this.url = input || 'http://localhost:3000'
      this.method = init?.method || 'GET'
      this.headers = new Map(Object.entries(init?.headers || {}))
    }
    
    json() {
      return Promise.resolve({})
    }
  },
  NextResponse: {
    json: (data, init) => ({
      json: () => Promise.resolve(data),
      status: init?.status || 200,
      ok: (init?.status || 200) < 400
    }),
    redirect: (url, status) => ({ redirect: true, url, status })
  }
}))

// Mock next-themes
jest.mock('next-themes', () => ({
  useTheme: () => ({
    theme: 'light',
    setTheme: jest.fn(),
    resolvedTheme: 'light',
    themes: ['light', 'dark', 'system'],
    systemTheme: 'light',
  }),
  ThemeProvider: ({ children }) => children,
}))

// Mock Upstash Redis
jest.mock('@upstash/redis', () => ({
  Redis: jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
    pipeline: jest.fn(() => ({
      get: jest.fn(),
      set: jest.fn(),
      incr: jest.fn(),
      expire: jest.fn(),
      exec: jest.fn().mockResolvedValue([]),
    })),
  })),
}))

// Mock Upstash rate limit
jest.mock('@upstash/ratelimit', () => ({
  Ratelimit: jest.fn().mockImplementation(() => ({
    limit: jest.fn().mockResolvedValue({
      success: true,
      limit: 100,
      remaining: 99,
      reset: Date.now() + 60000,
    }),
  })),
  Algorithm: {
    SlidingWindow: jest.fn(),
  },
}))

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key'

// Mock fetch globally
global.fetch = jest.fn()

// Mock window.matchMedia for tests that might use it (like responsive components)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Mock IntersectionObserver for components that might use it
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock ResizeObserver for components that might use it
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Suppress console warnings in tests unless specifically testing them
const originalConsoleError = console.error
const originalConsoleWarn = console.warn

console.error = (...args) => {
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('Warning:') || args[0].includes('ReactDOMTestUtils'))
  ) {
    return
  }
  originalConsoleError.call(console, ...args)
}

console.warn = (...args) => {
  if (
    typeof args[0] === 'string' &&
    args[0].includes('Warning:')
  ) {
    return
  }
  originalConsoleWarn.call(console, ...args)
}

// Mock crypto for nanoid
Object.defineProperty(globalThis, 'crypto', {
  value: {
    getRandomValues: (arr) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256)
      }
      return arr
    },
    randomUUID: () => '12345678-1234-1234-1234-123456789012',
  }
})

// Mock HTMLElement methods that might not be available in jsdom
HTMLElement.prototype.scrollIntoView = jest.fn()
HTMLElement.prototype.hasPointerCapture = jest.fn()
HTMLElement.prototype.releasePointerCapture = jest.fn()
HTMLElement.prototype.setPointerCapture = jest.fn()

// Reset all mocks after each test
afterEach(() => {
  jest.clearAllMocks()
  if (global.fetch && global.fetch.mockClear) {
    global.fetch.mockClear()
  }
})