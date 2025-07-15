import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ApiKeyInput } from './components/ApiKeyInput'
import { SandboxList } from './components/SandboxList'
import { SandboxManager } from './components/SandboxManager'
import { CliDashboard } from './components/CliDashboard'
import { useCodeSandbox } from './hooks/useCodeSandbox'
import { List, Code } from 'lucide-react'

const queryClient = new QueryClient()

function Dashboard() {
  const [apiKey, setApiKey] = useState<string | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  const [currentView, setCurrentView] = useState<'sandboxes' | 'cli'>('sandboxes')

  const {
    sandboxes,
    activeSandbox,
    isLoadingSandboxes,
    sandboxesError,
    connectionError,
    createSandbox,
    connectToSandbox,
    createAndConnect,
    disconnectFromSandbox,
    refreshSandboxes
  } = useCodeSandbox(apiKey)

  const handleApiKeySubmit = async (newApiKey: string) => {
    setApiError(null)
    try {
      // Test the API key by creating a temporary SDK instance
      const { createSDK } = await import('./lib/codesandbox')
      const testSdk = createSDK(newApiKey)
      
      // Make a simple API call to verify the key
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
        apiKey={apiKey}
      />
    )
  }

  // Show main dashboard with tabs
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            CodeSandbox SDK Dashboard
          </h1>
          <p className="text-gray-600">
            Manage your sandboxes using the browser SDK with session management
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow mb-6">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setCurrentView('sandboxes')}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                currentView === 'sandboxes'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <List className="w-4 h-4" />
              <span>Sandbox Management</span>
            </button>
            <button
              onClick={() => setCurrentView('cli')}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                currentView === 'cli'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Code className="w-4 h-4" />
              <span>CLI Dashboard</span>
            </button>
          </nav>
        </div>

        {/* Content based on current view */}
        {currentView === 'sandboxes' && (
          <>
            {sandboxesError && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600">{sandboxesError.message}</p>
              </div>
            )}

            {connectionError && (
              <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <h3 className="font-semibold text-orange-800 mb-2">Connection Error</h3>
                <p className="text-orange-700 mb-3">{connectionError}</p>
                <div className="text-sm text-orange-600">
                  <p className="font-medium mb-1">Troubleshooting tips:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Wait a moment for the sandbox to fully start, then try again</li>
                    <li>Try creating a new sandbox with the "Create & Connect" button</li>
                    <li>Check your internet connection and refresh the page</li>
                    <li>The browser SDK will auto-reconnect if the connection is temporarily lost</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Browser SDK Test Section */}
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-semibold text-blue-800 mb-2">🚀 Browser SDK Connection</h3>
              <p className="text-blue-700 mb-3">
                Create a new sandbox and connect to access terminal, preview, and task management!
              </p>
              <button
                onClick={() => createAndConnect()}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create New Sandbox & Connect
              </button>
              <p className="text-xs text-blue-600 mt-2">
                This will create a fresh sandbox and connect using the browser SDK pattern with full dashboard access.
              </p>
            </div>

            <SandboxList
              sandboxes={sandboxes}
              isLoading={isLoadingSandboxes}
              onCreateSandbox={createSandbox}
              onConnectToSandbox={connectToSandbox}
            />
          </>
        )}

        {currentView === 'cli' && (
          <CliDashboard apiKey={apiKey} sandboxes={sandboxes} refreshSandboxes={refreshSandboxes} />
        )}
      </div>
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Dashboard />
    </QueryClientProvider>
  )
}