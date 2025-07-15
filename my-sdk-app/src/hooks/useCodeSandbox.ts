import { useState, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createSDK, connectToBrowserSandbox, type SandboxWithClient } from '../lib/codesandbox'

export function useCodeSandbox(apiKey: string | null) {
  const queryClient = useQueryClient()
  const [activeSandbox, setActiveSandbox] = useState<SandboxWithClient | null>(null)
  const [connectionError, setConnectionError] = useState<string | null>(null)

  // Create SDK instance
  const sdk = apiKey ? createSDK(apiKey) : null

  // Listen for global CodeSandbox connection errors
  useEffect(() => {
    const handleConnectionError = (event: CustomEvent) => {
      console.error('CodeSandbox connection error detected:', event.detail.error)
      
      // Only handle if we have an active sandbox
      if (activeSandbox) {
        setConnectionError('Connection lost due to WebSocket error. Please try reconnecting.')
        
        // Disconnect the current sandbox
        if (activeSandbox.client) {
          try {
            activeSandbox.client.disconnect()
          } catch (error) {
            console.error('Error disconnecting client after connection error:', error)
          }
        }
        
        setActiveSandbox(null)
      }
    }

    window.addEventListener('codesandbox-connection-error', handleConnectionError as EventListener)
    
    return () => {
      window.removeEventListener('codesandbox-connection-error', handleConnectionError as EventListener)
    }
  }, [activeSandbox])

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
        pagination: { pageSize: 20 }
      })
      return result.sandboxes
    },
    enabled: !!sdk,
    refetchInterval: 30000 // Refresh every 30 seconds
  })

  // Mutation: Create sandbox with advanced options
  const createSandboxMutation = useMutation({
    mutationFn: async (params: {
      title?: string
      description?: string
      templateId?: string
      privacy?: 'private' | 'unlisted' | 'public'
      tags?: string[]
      path?: string
      ipcountry?: string
      vmTier?: string
      hibernationTimeoutSeconds?: number
      automaticWakeupConfig?: {
        http: boolean
        websocket: boolean
      }
    }) => {
      if (!sdk) throw new Error('No API key provided')
      
      // Build the creation parameters with all available options
      const createParams: any = {
        title: params.title || 'SDK Dashboard Sandbox',
        description: params.description || 'Created with SDK Dashboard',
        privacy: params.privacy || 'unlisted'
      }

      // Add template ID if provided
      if (params.templateId) {
        createParams.id = params.templateId
      }

      // Add advanced options if provided
      if (params.tags && params.tags.length > 0) {
        createParams.tags = params.tags
      }

      if (params.path) {
        createParams.path = params.path
      }

      if (params.ipcountry) {
        createParams.ipcountry = params.ipcountry
      }

      if (params.vmTier && params.vmTier !== 'pico') {
        // Map string to VMTier enum if available
        createParams.vmTier = params.vmTier
      }

      if (params.hibernationTimeoutSeconds && params.hibernationTimeoutSeconds !== 300) {
        createParams.hibernationTimeoutSeconds = params.hibernationTimeoutSeconds
      }

      if (params.automaticWakeupConfig) {
        createParams.automaticWakeupConfig = params.automaticWakeupConfig
      }

      console.log('Creating sandbox with advanced options:', createParams)
      
      return await sdk.sandboxes.create(createParams)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sandboxes'] })
    }
  })

  // Browser connection method using the proper browser SDK pattern
  const connectToSandbox = useCallback(async (sandboxInfo: any) => {
    if (!sandboxInfo || !sdk) return

    console.log('Connecting to sandbox using browser SDK...', sandboxInfo.id)
    
    // Clear any previous errors and set connecting state
    setConnectionError(null)
    setActiveSandbox({
      sandbox: null,
      client: null,
      isConnecting: true
    })

    try {
      // Use the browser connection method with session management
      const { client, sandbox } = await connectToBrowserSandbox(
        sdk, 
        sandboxInfo.id,
        {
          // Show initialization progress
          initStatusCb: (event) => {
            console.log('Initialization status:', event)
          }
        }
      )
      
      console.log('Browser connection established!')
      
      // Add the original sandbox info as additional properties
      // We'll store the original sandbox info separately to preserve the title and other metadata
      const sandboxWithMetadata = sandbox as any
      sandboxWithMetadata.title = sandboxInfo.title
      sandboxWithMetadata.privacy = sandboxInfo.privacy
      sandboxWithMetadata.createdAt = sandboxInfo.createdAt
      sandboxWithMetadata.updatedAt = sandboxInfo.updatedAt
      sandboxWithMetadata.tags = sandboxInfo.tags
      
      // Set as active
      setActiveSandbox({
        sandbox: sandboxWithMetadata,
        client,
        isConnecting: false
      })

      console.log('Connection successful!')
      return client
    } catch (error) {
      console.error('Browser connection failed:', error)
      
      let errorMessage = 'Failed to connect to sandbox'
      if (error instanceof Error) {
        if (error.message.includes('WebSocket')) {
          errorMessage = 'WebSocket connection failed. Please check your internet connection and try again.'
        } else if (error.message.includes('session')) {
          errorMessage = 'Failed to create sandbox session. The sandbox may be starting up - try again in a moment.'
        } else {
          errorMessage = `Connection failed: ${error.message}`
        }
      }
      
      setConnectionError(errorMessage)
      setActiveSandbox(null)
      throw error
    }
  }, [sdk])

  // Create and connect to a new sandbox (useful for testing)
  const createAndConnect = useCallback(async (params: { title?: string; templateId?: string } = {}) => {
    if (!sdk) return

    console.log('Creating and connecting to new sandbox...')
    
    // Clear any previous errors and set connecting state
    setConnectionError(null)
    setActiveSandbox({
      sandbox: null,
      client: null,
      isConnecting: true
    })

    try {
      // Create new sandbox
      console.log('Creating new sandbox...')
      const sandbox = await sdk.sandboxes.create({
        title: params.title || 'Browser SDK Test Sandbox',
        description: 'Created and connected using browser SDK',
        id: params.templateId,
        privacy: 'unlisted'
      })
      
      // Refresh sandbox list
      queryClient.invalidateQueries({ queryKey: ['sandboxes'] })
      
      // Connect using browser method
      const { client } = await connectToBrowserSandbox(
        sdk,
        sandbox.id,
        {
          initStatusCb: (event) => {
            console.log('New sandbox initialization status:', event)
          }
        }
      )
      
      console.log('Create and connect successful!')
      
      // Set as active
      setActiveSandbox({
        sandbox,
        client,
        isConnecting: false
      })

      return client
    } catch (error) {
      console.error('Create and connect failed:', error)
      
      let errorMessage = 'Failed to create and connect to sandbox'
      if (error instanceof Error) {
        errorMessage = `Create and connect failed: ${error.message}`
      }
      
      setConnectionError(errorMessage)
      setActiveSandbox(null)
      throw error
    }
  }, [sdk, queryClient])

  // Disconnect from sandbox
  const disconnectFromSandbox = useCallback(() => {
    if (activeSandbox?.client) {
      try {
        // Use the proper disconnect method for browser clients
        activeSandbox.client.disconnect()
      } catch (error) {
        console.error('Error disconnecting client:', error)
      }
    }
    setActiveSandbox(null)
    setConnectionError(null)
  }, [activeSandbox])

  // Wrap createSandbox to match expected interface and handle advanced options
  const createSandboxWrapper = async (params: { 
    title?: string
    templateId?: string
    description?: string
    privacy?: 'private' | 'unlisted' | 'public'
    tags?: string[]
    path?: string
    ipcountry?: string
    vmTier?: string
    hibernationTimeoutSeconds?: number
    automaticWakeupConfig?: {
      http: boolean
      websocket: boolean
    }
  }) => {
    await createSandboxMutation.mutateAsync({
      title: params.title,
      templateId: params.templateId,
      description: params.description || (params.title ? `${params.title} - Created with SDK Dashboard` : undefined),
      privacy: params.privacy,
      tags: params.tags,
      path: params.path,
      ipcountry: params.ipcountry,
      vmTier: params.vmTier,
      hibernationTimeoutSeconds: params.hibernationTimeoutSeconds,
      automaticWakeupConfig: params.automaticWakeupConfig
    })
  }



  return {
    // Data
    sandboxes,
    activeSandbox,
    
    // Loading states
    isLoadingSandboxes,
    
    // Errors
    sandboxesError,
    connectionError,
    
    // Actions
    createSandbox: createSandboxWrapper,
    connectToSandbox, // Now uses proper browser SDK
    createAndConnect, // New method for testing
    disconnectFromSandbox,
    refreshSandboxes: () => queryClient.invalidateQueries({ queryKey: ['sandboxes'] }),
    
    // Utilities
    sdk
  }
}