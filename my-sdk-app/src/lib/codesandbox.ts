// Browser-specific SDK import
import { connectToSandbox, createPreview } from '@codesandbox/sdk/browser'

// Keep the regular SDK for session creation and management
import { CodeSandbox, Sandbox } from '@codesandbox/sdk'
import type { SandboxClient } from '@codesandbox/sdk'

// Export the browser-specific connectToSandbox
export { connectToSandbox, createPreview }

// Keep the existing SDK for session creation
export { CodeSandbox, Sandbox, type SandboxClient }

// Create SDK instance 
export function createSDK(apiKey: string) {
  const sdk = new CodeSandbox(apiKey)
  
  if (process.env.NODE_ENV === 'development') {
    console.log('CodeSandbox SDK initialized for browser use')
  }
  
  return sdk
}

// Browser-specific connection function
export async function connectToBrowserSandbox(
  sdk: CodeSandbox, 
  sandboxId: string,
  options?: {
    initStatusCb?: (event: any) => void
    onFocusChange?: (notify: (visible: boolean) => void) => (() => void)
  }
) {
  // Step 1: Resume the sandbox and create initial session
  console.log('Resuming sandbox for browser connection...', sandboxId)
  const sandbox = await sdk.sandboxes.resume(sandboxId)
  
  console.log('Creating initial session...')
  const initialSession = await sandbox.createSession()
  
  console.log('Initial session created:', initialSession)
  
  // Step 2: Connect using browser SDK with session management
  const client = await connectToSandbox({
    session: initialSession,
    // Handle reconnection by creating new sessions when needed
    getSession: async (id: string) => {
      console.log('getSession called for reconnection, id:', id)
      try {
        // Resume the sandbox and create a new session for reconnection
        const reconnectSandbox = await sdk.sandboxes.resume(id)
        const newSession = await reconnectSandbox.createSession()
        console.log('New session created for reconnection:', newSession)
        return newSession
      } catch (error) {
        console.error('Failed to create session for reconnection:', error)
        throw error
      }
    },
    // Default focus change handler for automatic reconnection
    onFocusChange: options?.onFocusChange || ((notify) => {
      const onVisibilityChange = () => {
        notify(document.visibilityState === 'visible')
      }
      document.addEventListener('visibilitychange', onVisibilityChange)
      return () => {
        document.removeEventListener('visibilitychange', onVisibilityChange)
      }
    }),
    // Optional initialization callback
    initStatusCb: options?.initStatusCb
  })
  
  console.log('Browser client connected successfully!')
  return { client, sandbox }
}

// Custom types for our app
export interface SandboxWithClient {
  sandbox: Sandbox | null
  client: SandboxClient | null
  isConnecting: boolean
}

export interface CommandExecution {
  id: string
  command: string
  output: string
  isRunning: boolean
  timestamp: Date
}

export interface FileItem {
  name: string
  type: 'file' | 'directory'
  path: string
  size?: number
}