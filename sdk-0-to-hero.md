# CodeSandbox SDK: Zero to Hero Guide

> Build a complete sandbox management dashboard with React + TypeScript

This guide teaches you how to build a production-ready CodeSandbox SDK application from scratch. We'll start with a simple test and progressively build a comprehensive dashboard with all the advanced features.

## 📚 What You'll Build

By the end of this guide, you'll have a complete dashboard that can:
- ✅ **Manage Sandboxes** - Create, list, and organize your development environments
- ✅ **Browser Connections** - Connect directly to sandboxes from your dashboard  
- ✅ **Live Terminals** - Execute commands and see real-time output
- ✅ **Preview Applications** - View running apps with port management
- ✅ **File Management** - Browse, edit, and manage sandbox files
- ✅ **Host Tokens** - Secure access to private sandbox content
- ✅ **CLI Dashboard** - Use the powerful undocumented CLI tools

## 🚀 Quick Start

**Prerequisites:** Node.js 18+, CodeSandbox API key from [codesandbox.io/t/api](https://codesandbox.io/t/api)

```bash
# Clone the complete example
git clone https://github.com/your-repo/sdk-dashboard
cd sdk-dashboard
npm install
echo "VITE_CSB_API_KEY=your_api_key_here" > .env.local
npm run dev
```

Or follow the step-by-step guide below to build it yourself!

---

## Stage 1: First Test Example

**Goal:** Verify the SDK works and understand basic patterns

Let's start with a simple test to make sure everything works:

### Setup

```bash
mkdir sdk-test && cd sdk-test
npm init -y
npm install @codesandbox/sdk
```

Create `test.mjs`:

```javascript
import { CodeSandbox } from "@codesandbox/sdk";

async function testSDK() {
  // Replace with your API key from codesandbox.io/t/api
  const sdk = new CodeSandbox("your_api_key_here");
  
  try {
    console.log("🔍 Testing SDK connection...");
    
    // Test 1: List existing sandboxes
    const result = await sdk.sandboxes.list({ pagination: { pageSize: 5 } });
    console.log(`✅ Found ${result.sandboxes.length} existing sandboxes`);
    
    // Test 2: Create a new sandbox
    console.log("🏗️  Creating test sandbox...");
    const sandbox = await sdk.sandboxes.create({
      title: "SDK Test Sandbox",
      id: "9qputt", // React TypeScript template
      privacy: "unlisted"
    });
    console.log(`✅ Created sandbox: ${sandbox.id}`);
    
    // Test 3: Connect to the sandbox
    console.log("🔌 Connecting to sandbox...");
    const resumedSandbox = await sdk.sandboxes.resume(sandbox.id);
    await resumedSandbox.createSession();
    const client = await resumedSandbox.connect();
    console.log("✅ Connected successfully!");
    
    // Test 4: Run a simple command
    console.log("💻 Running test command...");
    const output = await client.commands.run("echo 'Hello from CodeSandbox SDK!'");
    console.log(`📝 Command output: ${output.trim()}`);
    
    // Cleanup
    client.dispose();
    console.log("🎉 All tests passed! SDK is working correctly.");
    
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    process.exit(1);
  }
}

testSDK();
```

Run the test:

```bash
node test.mjs
```

**What you should see:**
```
🔍 Testing SDK connection...
✅ Found 3 existing sandboxes
🏗️  Creating test sandbox...
✅ Created sandbox: abc123def456
🔌 Connecting to sandbox...
✅ Connected successfully!
💻 Running test command...
📝 Command output: Hello from CodeSandbox SDK!
🎉 All tests passed! SDK is working correctly.
```

### Key Patterns Learned

1. **API Key Authentication** - SDK requires valid API key
2. **Three-Step Connection** - List → Resume → Connect
3. **Session Management** - Always create session before connecting
4. **Command Execution** - Use `client.commands.run()` for shell commands
5. **Proper Cleanup** - Call `client.dispose()` when done

---

## Stage 2: Basic Dashboard

**Goal:** Build a React dashboard to create and list sandboxes

Now let's build a proper web interface:

### Project Setup

```bash
npm create vite@latest my-sdk-dashboard -- --template react-ts
cd my-sdk-dashboard
npm install @codesandbox/sdk @tanstack/react-query lucide-react clsx
npm install -D tailwindcss @tailwindcss/vite
```

### Configuration

Update `vite.config.ts`:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    'process.env': {}
  },
  optimizeDeps: {
    include: ['@codesandbox/sdk']
  }
})
```

Update `src/index.css`:

```css
@import "tailwindcss";

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
  -webkit-font-smoothing: antialiased;
}
```

### Core SDK Utilities

Create `src/lib/codesandbox.ts`:

```typescript
import { CodeSandbox } from '@codesandbox/sdk'

export function createSDK(apiKey: string) {
  return new CodeSandbox(apiKey)
}

export interface SandboxInfo {
  id: string
  title: string
  privacy: 'private' | 'unlisted' | 'public'
  createdAt: string
  updatedAt: string
  tags: string[]
}
```

### API Key Input Component

Create `src/components/ApiKeyInput.tsx`:

```typescript
import { useState } from 'react'
import { Key, AlertCircle } from 'lucide-react'

interface ApiKeyInputProps {
  onApiKeySubmit: (apiKey: string) => void
  error?: string
}

export function ApiKeyInput({ onApiKeySubmit, error }: ApiKeyInputProps) {
  const [apiKey, setApiKey] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (apiKey.trim()) {
      onApiKeySubmit(apiKey.trim())
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Key className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            CodeSandbox SDK Dashboard
          </h1>
          <p className="text-gray-600">
            Enter your API key to get started
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-2">
              API Key
            </label>
            <input
              type="password"
              id="apiKey"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your CodeSandbox API key"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          {error && (
            <div className="flex items-center space-x-2 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            Connect to CodeSandbox
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            Get your API key from{' '}
            <a
              href="https://codesandbox.io/t/api"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              codesandbox.io/t/api
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
```

### Sandbox List Component

Create `src/components/SandboxList.tsx`:

```typescript
import { useState } from 'react'
import { Plus, Play, Calendar, Lock, Globe, Eye, Loader2 } from 'lucide-react'
import { type SandboxInfo } from '../lib/codesandbox'

interface SandboxListProps {
  sandboxes: SandboxInfo[]
  isLoading: boolean
  onCreateSandbox: (params: { title?: string; templateId?: string }) => Promise<void>
  onConnectToSandbox: (sandbox: SandboxInfo) => void
}

export function SandboxList({
  sandboxes,
  isLoading,
  onCreateSandbox,
  onConnectToSandbox
}: SandboxListProps) {
  const [isCreating, setIsCreating] = useState(false)
  const [newSandboxTitle, setNewSandboxTitle] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState('9qputt')

  const templates = [
    { id: '9qputt', name: 'React (TypeScript)', description: 'React with TypeScript using Vite' },
    { id: 'fxis37', name: 'Next.js', description: 'Full-stack React framework' },
    { id: 'pb6sit', name: 'Vue 3', description: 'Vue 3 with Vite' },
    { id: 'k8dsq1', name: 'Node.js', description: 'Server-side JavaScript environment' },
    { id: '', name: 'Blank', description: 'Start from scratch' }
  ]

  const handleCreateSandbox = async () => {
    setIsCreating(true)
    try {
      await onCreateSandbox({
        title: newSandboxTitle || undefined,
        templateId: selectedTemplate || undefined
      })
      setNewSandboxTitle('')
    } finally {
      setIsCreating(false)
    }
  }

  const getPrivacyIcon = (privacy: string) => {
    switch (privacy) {
      case 'private': return <Lock className="w-4 h-4 text-red-500" />
      case 'public': return <Globe className="w-4 h-4 text-green-500" />
      default: return <Eye className="w-4 h-4 text-blue-500" />
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <div className="space-y-6">
      {/* Create New Sandbox */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Create New Sandbox</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Title (optional)
            </label>
            <input
              type="text"
              value={newSandboxTitle}
              onChange={(e) => setNewSandboxTitle(e.target.value)}
              placeholder="My Awesome Project"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Template
            </label>
            <select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name} - {template.description}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleCreateSandbox}
            disabled={isCreating}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isCreating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            <span>{isCreating ? 'Creating...' : 'Create Sandbox'}</span>
          </button>
        </div>
      </div>

      {/* Sandboxes List */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Your Sandboxes ({sandboxes.length})</h2>
        </div>

        {isLoading ? (
          <div className="p-6">
            <div className="animate-pulse space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        ) : sandboxes.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No sandboxes found. Create your first one above!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
            {sandboxes.map((sandbox) => (
              <div key={sandbox.id} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">
                      {sandbox.title || 'Untitled Sandbox'}
                    </h3>
                    <p className="text-sm text-gray-500 truncate">
                      {sandbox.id}
                    </p>
                  </div>
                  <div className="flex items-center space-x-1 ml-2">
                    {getPrivacyIcon(sandbox.privacy)}
                  </div>
                </div>

                <div className="flex items-center space-x-4 text-xs text-gray-500 mb-4">
                  <div className="flex items-center space-x-1">
                    <Calendar className="w-3 h-3" />
                    <span>Created {formatDate(sandbox.createdAt)}</span>
                  </div>
                </div>

                <div className="flex space-x-2">
                  <a
                    href={`https://codesandbox.io/p/devbox/${sandbox.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 px-3 py-2 text-sm text-center text-blue-600 hover:bg-blue-50 rounded border border-blue-300"
                  >
                    Open in CodeSandbox
                  </a>
                  <button
                    onClick={() => onConnectToSandbox(sandbox)}
                    className="flex items-center space-x-1 px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                  >
                    <Play className="w-3 h-3" />
                    <span>Connect</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

### Main App with React Query

Create `src/hooks/useCodeSandbox.ts`:

```typescript
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createSDK, type SandboxInfo } from '../lib/codesandbox'
import { connectToBrowserSandbox, type SandboxWithClient } from '../lib/browser-connection'

export function useCodeSandbox(apiKey: string | null) {
  const queryClient = useQueryClient()

  // Create SDK instance
  const sdk = apiKey ? createSDK(apiKey) : null

  // Query: List sandboxes
  const {
    data: sandboxes = [],
    isLoading: isLoadingSandboxes,
    error: sandboxesError
  } = useQuery({
    queryKey: ['sandboxes'],
    queryFn: async () => {
      if (!sdk) throw new Error('No API key provided')
      const result = await sdk.sandboxes.list({ 
        pagination: { pageSize: 50 }
      })
      return result.sandboxes as SandboxInfo[]
    },
    enabled: !!sdk,
    refetchInterval: 30000
  })

  // Mutation: Create sandbox
  const createSandboxMutation = useMutation({
    mutationFn: async (params: {
      title?: string
      templateId?: string
    }) => {
      if (!sdk) throw new Error('No API key provided')
      
      return await sdk.sandboxes.create({
        title: params.title || 'SDK Dashboard Sandbox',
        id: params.templateId,
        privacy: 'unlisted'
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sandboxes'] })
    }
  })

  return {
    // Data
    sandboxes,
    
    // Loading states
    isLoadingSandboxes,
    
    // Errors
    sandboxesError,
    
    // Actions
    createSandbox: createSandboxMutation.mutateAsync,
    
    // Utilities
    sdk
  }
}
```

Update `src/App.tsx`:

```typescript
import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ApiKeyInput } from './components/ApiKeyInput'
import { SandboxList } from './components/SandboxList'
import { SandboxManager } from './components/SandboxManager'
import { useCodeSandbox } from './hooks/useCodeSandbox'
import { createSDK } from './lib/codesandbox'

const queryClient = new QueryClient()

function Dashboard() {
  const [apiKey, setApiKey] = useState<string | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)

  const {
    sandboxes,
    activeSandbox,
    isLoadingSandboxes,
    sandboxesError,
    connectionError,
    createSandbox,
    connectToSandbox,
    disconnectFromSandbox
  } = useCodeSandbox(apiKey)

  const handleApiKeySubmit = async (newApiKey: string) => {
    setApiError(null)
    try {
      const testSdk = createSDK(newApiKey)
      await testSdk.sandboxes.list({ pagination: { pageSize: 1 } })
      setApiKey(newApiKey)
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Invalid API key')
    }
  }

  // Show API key input if no key is set
  if (!apiKey) {
    return <ApiKeyInput onApiKeySubmit={handleApiKeySubmit} error={apiError || undefined} />
  }

  // Show sandbox manager if connected to a sandbox
  if (activeSandbox) {
    return (
      <SandboxManager 
        sandboxWithClient={activeSandbox} 
        onDisconnect={disconnectFromSandbox}
      />
    )
  }

  // Show sandboxes list
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            CodeSandbox SDK Dashboard
          </h1>
          <p className="text-gray-600">
            Manage your sandboxes and development environments
          </p>
        </div>

        {sandboxesError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600">{sandboxesError.message}</p>
          </div>
        )}

        {connectionError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600">Connection Error: {connectionError}</p>
          </div>
        )}

        <SandboxList
          sandboxes={sandboxes}
          isLoading={isLoadingSandboxes}
          onCreateSandbox={createSandbox}
          onConnectToSandbox={connectToSandbox}
        />
      </div>
    </div>
  )
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Dashboard />
    </QueryClientProvider>
  )
}

export default App
```

### Test Stage 3

```bash
npm run dev
```

You should now be able to:
- ✅ Click "Connect" on any sandbox
- ✅ See a loading spinner while connecting
- ✅ View the connected sandbox with tabs
- ✅ See connection information
- ✅ Navigate back to the sandbox list

**Next:** Add terminal, preview, and task functionality in Stage 4.

---

*The guide continues with Stages 4-6, building out terminals/previews/tasks, file/host token management, and the CLI dashboard respectively...*