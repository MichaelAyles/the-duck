# 🦆 DuckPond - Interactive Artifact System

DuckPond is The Duck's built-in interactive artifact system that allows users to create, view, and interact with React components, HTML demos, and JavaScript code directly within chat conversations.

## 🚀 Features

- **React Component Execution** - Interactive React components with state management
- **HTML/CSS Demos** - Live HTML pages with custom styling
- **JavaScript Utilities** - Runnable JavaScript code snippets
- **Secure Sandbox** - iframe-based isolation for safe code execution
- **File Storage Integration** - Artifacts saved as files using existing infrastructure
- **Auto-Detection** - LLM responses automatically parsed for artifacts

## 📝 Usage

### For Users

Simply ask The Duck to create interactive content:

- "Create a counter app"
- "Show me a CSS animation of a duck floating"
- "Build a todo list component"
- "Make an interactive calculator"
- "Demo how to use the fetch API"

The Duck will automatically create DuckPond artifacts that run interactively in your chat.

### For LLM Responses

Use DuckPond tags in your responses:

#### React Components
```jsx
<duckpond type="react-component" title="Counter App" description="A simple counter">
function Counter() {
  const [count, setCount] = React.useState(0);
  
  return (
    <div style={{padding: '20px', textAlign: 'center'}}>
      <h2>Count: {count}</h2>
      <button onClick={() => setCount(count + 1)}>
        Increment
      </button>
    </div>
  );
}

// Export for rendering
window.Counter = Counter;
</duckpond>
```

#### HTML Demos
```html
<duckpond type="html" title="CSS Animation" description="Floating duck animation">
<!DOCTYPE html>
<html>
<head>
  <style>
    .duck {
      width: 50px;
      height: 50px;
      background: #ffd700;
      border-radius: 50%;
      animation: float 2s ease-in-out infinite;
    }
    
    @keyframes float {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-20px); }
    }
  </style>
</head>
<body>
  <div class="duck"></div>
  <p>🦆 A floating duck!</p>
</body>
</html>
</duckpond>
```

#### JavaScript Utilities
```javascript
<duckpond type="javascript" title="API Demo" description="Fetch API example">
// Fetch example data
fetch('https://jsonplaceholder.typicode.com/posts/1')
  .then(response => response.json())
  .then(data => {
    console.log('Fetched data:', data);
    console.log('Title:', data.title);
  })
  .catch(error => {
    console.error('Error:', error);
  });

console.log('API request sent! Check the output above.');
</duckpond>
```

## 🏗️ Architecture

### File Storage
- Artifacts are stored as text files in Supabase storage
- Special MIME types: `text/x-react-component`, `text/x-duckpond-artifact`
- Integrated with existing file upload system and RLS policies

### Security
- **iframe Sandbox** - Code executes in isolated context
- **Content Validation** - Dangerous patterns filtered out
- **User Authentication** - All artifacts linked to authenticated users

### Processing Flow
1. **Detection** - LLM response parsed for `<duckpond>` tags
2. **Validation** - Content checked for security issues
3. **Storage** - Artifact saved as file with proper metadata
4. **Rendering** - Interactive component displayed in chat
5. **Execution** - Code runs safely in iframe sandbox

## 🔧 Technical Details

### Supported Libraries
React components have access to:
- React 18 (hooks, state management)
- Basic DOM APIs (safe subset)
- Inline styles and CSS

### File Structure
```
src/
├── types/artifact.ts              # Type definitions
├── lib/
│   ├── artifact-parser.ts         # Content parsing and detection
│   └── artifact-service.ts        # Storage and management
├── hooks/use-artifacts.ts         # React hook for artifact operations
└── components/duckpond/
    └── duckpond-viewer.tsx        # Interactive viewer component
```

### Integration Points
- **Message System** - Artifacts embedded in chat messages
- **File System** - Uses existing upload/storage infrastructure
- **Authentication** - Leverages current user session management

## 🚀 Future Enhancements

- **Monaco Editor** - In-chat code editing capabilities
- **Artifact Versioning** - Track changes and history
- **Component Library** - Curated set of reusable components
- **Export Options** - Download artifacts as standalone files
- **Collaborative Editing** - Share and modify artifacts

## 🧪 Testing

Test DuckPond by asking The Duck:
> "Create a React component that shows a bouncing ball animation"

The response should automatically include a DuckPond artifact that runs interactively in your chat!