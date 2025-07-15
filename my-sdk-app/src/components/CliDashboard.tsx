import { useState, useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import {
  Code,
  Power,
  Moon,
  Activity,
  Search,
  Info,
  X,
  List,
  Terminal as TerminalIcon,
  RefreshCw,
  Plus
} from 'lucide-react'
import { createSDK, connectToBrowserSandbox } from '../lib/codesandbox'

interface CliDashboardProps {
  apiKey: string
  sandboxes: any[]
  refreshSandboxes: () => Promise<void>
}

interface TerminalSession {
  terminal: any
  xterm: Terminal
  fitAddon: FitAddon
  isConnected: boolean
}

export function CliDashboard({ apiKey, sandboxes, refreshSandboxes }: CliDashboardProps) {
  const [sandbox, setSandbox] = useState<any>(null)
  const [isCreatingSandbox, setIsCreatingSandbox] = useState(false)
  const [terminalSession, setTerminalSession] = useState<TerminalSession | null>(null)
  const [isConnectingTerminal, setIsConnectingTerminal] = useState(false)
  const [selectedSandboxes, setSelectedSandboxes] = useState<Set<string>>(new Set())
  const [isInitialized, setIsInitialized] = useState(false) // Prevent duplicate initialization
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showRefreshNotification, setShowRefreshNotification] = useState(false)
  const [quickCommands] = useState([
    { 
      label: 'List All Sandboxes', 
      command: 'csb sandboxes list',
      icon: List,
      description: 'Show all sandboxes in your account'
    },
    { 
      label: 'Running Sandboxes', 
      command: 'csb sandboxes list --status running',
      icon: Activity,
      description: 'Show only running sandboxes'
    },
    { 
      label: 'Recent Sandboxes', 
      command: 'csb sandboxes list --since 7d --limit 10',
      icon: Search,
      description: 'Show sandboxes from last 7 days'
    },
    { 
      label: 'Hibernate Selected', 
      command: 'csb sandboxes hibernate',
      icon: Moon,
      description: 'Hibernate selected sandboxes'
    },
    { 
      label: 'Shutdown Selected', 
      command: 'csb sandboxes shutdown',
      icon: Power,
      description: 'Shutdown selected sandboxes'
    },
    { 
      label: 'CLI Help', 
      command: 'csb --help',
      icon: Info,
      description: 'Show CLI help and all available commands'
    },
    { 
      label: 'TUI Dashboard', 
      command: 'csb',
      icon: TerminalIcon,
      description: 'Launch interactive TUI dashboard'
    }
  ])

  const terminalContainerRef = useRef<HTMLDivElement>(null)

  // Find or create a CLI sandbox
  const findOrCreateCliSandbox = async () => {
    setIsCreatingSandbox(true)
    try {
      const sdk = createSDK(apiKey)
      
      // First, try to find an existing CLI dashboard sandbox
      const existingCliSandbox = sandboxes.find(sb => 
        sb.title === 'CLI Dashboard Terminal' || 
        sb.title?.includes('CLI Dashboard')
      )
      
      if (existingCliSandbox) {
        console.log('Reusing existing CLI dashboard sandbox:', existingCliSandbox.id)
        setSandbox(existingCliSandbox)
        return { sandbox: existingCliSandbox, isNew: false }
      }
      
      // If no existing CLI sandbox found, create a new one
      console.log('Creating new CLI dashboard sandbox...')
      const newSandbox = await sdk.sandboxes.create({
        title: 'CLI Dashboard Terminal',
        id: 'k8dsq1', // Use Node.js template ID
        privacy: 'unlisted'
      })
      
      setSandbox(newSandbox)
      return { sandbox: newSandbox, isNew: true }
    } catch (error) {
      console.error('Failed to find or create CLI sandbox:', error)
      throw error
    } finally {
      setIsCreatingSandbox(false)
    }
  }

  // Create a new CLI sandbox (force create)
  const createNewCliSandbox = async () => {
    setIsCreatingSandbox(true)
    try {
      const sdk = createSDK(apiKey)
      
      const newSandbox = await sdk.sandboxes.create({
        title: `CLI Dashboard Terminal ${new Date().toISOString().slice(0, 16)}`,
        id: 'k8dsq1',
        privacy: 'unlisted'
      })
      
      setSandbox(newSandbox)
      return { sandbox: newSandbox, isNew: true }
    } catch (error) {
      console.error('Failed to create new CLI sandbox:', error)
      throw error
    } finally {
      setIsCreatingSandbox(false)
    }
  }

  // Connect to the sandbox terminal
  const connectTerminal = async (targetSandbox: any, isNewSandbox: boolean = false) => {
    if (!targetSandbox) return
    
    setIsConnectingTerminal(true)
    try {
      const sdk = createSDK(apiKey)
      
      // Use the browser connection method from existing codebase
      const { client } = await connectToBrowserSandbox(sdk, targetSandbox.id)
      
      // Create terminal session
      const terminal = await client.terminals.create()
      
      // Create xterm instance with proper configuration
      const xterm = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: 'Monaco, "Lucida Console", monospace',
        theme: {
          background: '#1a1a1a',
          foreground: '#ffffff',
          cursor: '#ffffff'
        },
        cols: 80,
        rows: 24,
        scrollback: 1000,
        convertEol: true
      })

      const fitAddon = new FitAddon()
      xterm.loadAddon(fitAddon)

      // Ensure container exists and mount terminal
      if (terminalContainerRef.current) {
        // Clear any existing content
        terminalContainerRef.current.innerHTML = ''
        
        // Open terminal on DOM element
        xterm.open(terminalContainerRef.current)
        
        // Wait a bit for DOM to be ready, then fit
        setTimeout(() => {
          try {
            fitAddon.fit()
          } catch (error) {
            console.warn('Fit addon error:', error)
          }
        }, 100)
      }

      // Open terminal and get initial output
      const output = await terminal.open()
      if (output) {
        xterm.write(output)
      }

      // Set up bidirectional communication
      terminal.onOutput((output: string) => {
        xterm.write(output)
      })

      xterm.onData((data: string) => {
        terminal.write(data)
      })

      // Only run setup commands for new sandboxes
      if (isNewSandbox) {
        // Welcome message and install correct CLI
        setTimeout(() => {
          terminal.write('\r\n# 🎯 CodeSandbox CLI Terminal Ready\r\n')
          terminal.write('# Installing CodeSandbox CLI...\r\n')
          terminal.write('npm install -g @codesandbox/sdk\r\n')
        }, 1000)

        // Set up API key for CLI usage
        setTimeout(() => {
          terminal.write(`\r\n# Setting up API key for CLI...\r\n`)
          terminal.write(`export CSB_API_KEY="${apiKey}"\r\n`)
        }, 3000)
      } else {
        // Show reconnection message and set API key for existing sandboxes
        setTimeout(() => {
          terminal.write('\r\n# 🔄 Reconnected to CLI Dashboard Terminal\r\n')
          terminal.write('# Setting up API key for CLI...\r\n')
          terminal.write(`export CSB_API_KEY="${apiKey}"\r\n`)
          terminal.write('# CLI should be ready to use\r\n')
        }, 500)
      }

      const session: TerminalSession = {
        terminal,
        xterm,
        fitAddon,
        isConnected: true
      }

      setTerminalSession(session)
      
      // Handle window resize with debouncing
      const handleResize = () => {
        setTimeout(() => {
          if (session.fitAddon) {
            try {
              session.fitAddon.fit()
            } catch (error) {
              console.warn('Resize fit error:', error)
            }
          }
        }, 10)
      }
      
      window.addEventListener('resize', handleResize)
      
      return () => {
        window.removeEventListener('resize', handleResize)
      }
    } catch (error) {
      console.error('Failed to connect to terminal:', error)
      throw error
    } finally {
      setIsConnectingTerminal(false)
    }
  }

  // Execute CLI command in terminal
  const executeCommand = (command: string) => {
    if (!terminalSession?.terminal) {
      console.error('No terminal session available')
      return
    }

    // Add selected sandbox IDs for batch operations with comma separation
    if (command.includes('hibernate') || command.includes('shutdown')) {
      if (selectedSandboxes.size > 0) {
        const sandboxIds = Array.from(selectedSandboxes).join(', ')
        command = `${command} ${sandboxIds}`
      }
    }

    terminalSession.terminal.write(`${command}\r\n`)

    // Auto-refresh dashboard after hibernate/shutdown operations
    if (command.includes('hibernate') || command.includes('shutdown')) {
      // Wait a few seconds for the operation to complete, then refresh
      setTimeout(async () => {
        try {
          setShowRefreshNotification(true)
          await refreshSandboxes()
          console.log('Dashboard refreshed after CLI operation')
          // Hide notification after 2 seconds
          setTimeout(() => setShowRefreshNotification(false), 2000)
        } catch (error) {
          console.error('Failed to refresh dashboard:', error)
          setShowRefreshNotification(false)
        }
      }, 3000)
    }
  }

  // Manual refresh function
  const handleManualRefresh = async () => {
    setIsRefreshing(true)
    try {
      await refreshSandboxes()
    } catch (error) {
      console.error('Failed to refresh dashboard:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  // Clear terminal
  const clearTerminal = () => {
    if (terminalSession?.xterm) {
      terminalSession.xterm.clear()
    }
  }

  // Restart terminal connection
  const restartTerminal = async () => {
    if (terminalSession) {
      terminalSession.xterm.dispose()
      setTerminalSession(null)
    }
    
    if (sandbox) {
      await connectTerminal(sandbox, false) // Pass false to indicate it's not a new sandbox
    }
  }

  // Disconnect terminal
  const disconnectTerminal = () => {
    if (terminalSession) {
      terminalSession.xterm.dispose()
      setTerminalSession(null)
    }
    setIsInitialized(false) // Reset initialization flag when disconnecting
  }

  // Auto-create sandbox and connect terminal on mount
  useEffect(() => {
    // Only initialize when we have sandboxes loaded and haven't initialized yet
    if (sandboxes.length >= 0 && !terminalSession && !isCreatingSandbox && !isConnectingTerminal && !isInitialized) {
      const initializeTerminal = async () => {
        try {
          setIsInitialized(true) // Set flag immediately to prevent duplicate calls
          const { sandbox: newSandbox, isNew } = await findOrCreateCliSandbox()
          await connectTerminal(newSandbox, isNew)
        } catch (error) {
          console.error('Failed to initialize terminal:', error)
          setIsInitialized(false) // Reset flag on error so user can retry
        }
      }

      initializeTerminal()
    }

    // Cleanup on unmount
    return () => {
      disconnectTerminal()
    }
  }, [apiKey, sandboxes.length, isInitialized]) // Add isInitialized to dependencies

  // Handle sandbox selection for batch operations
  const toggleSandboxSelection = (sandboxId: string) => {
    const newSelection = new Set(selectedSandboxes)
    if (newSelection.has(sandboxId)) {
      newSelection.delete(sandboxId)
    } else {
      newSelection.add(sandboxId)
    }
    setSelectedSandboxes(newSelection)
  }

  const toggleSelectAll = () => {
    if (selectedSandboxes.size === sandboxes.length && sandboxes.length > 0) {
      setSelectedSandboxes(new Set())
    } else {
      setSelectedSandboxes(new Set(sandboxes.map(sb => sb.id)))
    }
  }

  const getSandboxStatus = (sandbox: any) => {
    if (new Date(sandbox.updatedAt || sandbox.createdAt) > new Date(Date.now() - 24 * 60 * 60 * 1000)) {
      return 'running'
    }
    return 'idle'
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-green-100 text-green-800'
      case 'hibernated': return 'bg-blue-100 text-blue-800'
      case 'idle': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
            <Code className="w-5 h-5" />
            <span>CLI Dashboard - Real Terminal</span>
          </h2>
          <div className="flex items-center space-x-2">
            {sandbox && (
              <span className="text-sm text-gray-600">
                Terminal Sandbox: {sandbox.title}
              </span>
            )}
            {terminalSession?.isConnected && (
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-xs text-green-600">Connected</span>
              </div>
            )}
            <button
              onClick={async () => {
                const { sandbox: newSandbox, isNew } = await createNewCliSandbox()
                await connectTerminal(newSandbox, isNew)
              }}
              disabled={isCreatingSandbox || isConnectingTerminal}
              className="flex items-center space-x-1 px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
            >
              <Plus className="w-3 h-3" />
              <span>New CLI Sandbox</span>
            </button>
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="flex items-center space-x-1 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh Dashboard</span>
            </button>
          </div>
        </div>

        <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
          <div className="flex">
            <Info className="w-5 h-5 text-blue-400 mr-2" />
            <div>
              <p className="text-sm text-blue-700">
                This dashboard executes real <code>csb</code> CLI commands in a live CodeSandbox terminal environment.
                {isCreatingSandbox && ' Creating terminal sandbox...'}
                {isConnectingTerminal && ' Connecting to terminal...'}
                {isRefreshing && ' Refreshing dashboard...'}
                {showRefreshNotification && (
                  <span className="ml-2 text-blue-700"> Dashboard refreshed!</span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sandbox Selection Panel */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900 flex items-center space-x-2">
              <List className="w-4 h-4" />
              <span>Sandbox Selection</span>
              <span className="text-sm text-gray-500">({selectedSandboxes.size} selected)</span>
            </h3>
          </div>
          <div className="p-4">
            {sandboxes.length > 0 && (
              <div className="mb-4">
                <label className="flex items-center space-x-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedSandboxes.size === sandboxes.length}
                    onChange={toggleSelectAll}
                    className="rounded"
                  />
                  <span>Select All ({sandboxes.length})</span>
                </label>
              </div>
            )}
            
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {sandboxes.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">
                  No sandboxes available
                </p>
              ) : (
                sandboxes.map((sandbox) => {
                  const status = getSandboxStatus(sandbox)
                  return (
                    <div
                      key={sandbox.id}
                      className="flex items-center space-x-3 p-3 border border-gray-200 rounded hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={selectedSandboxes.has(sandbox.id)}
                        onChange={() => toggleSandboxSelection(sandbox.id)}
                        className="rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {sandbox.title || 'Untitled'}
                          </p>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
                            {status}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 truncate">
                          {sandbox.id}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Batch Operations */}
            <div className="border-t pt-4 mt-4">
              <h4 className="text-sm font-medium text-gray-900 mb-3">
                Batch Operations ({selectedSandboxes.size} selected)
              </h4>
              <div className="flex space-x-2">
                <button
                  onClick={() => executeCommand('csb sandboxes hibernate')}
                  disabled={selectedSandboxes.size === 0 || !terminalSession?.isConnected}
                  className="flex items-center space-x-1 px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 disabled:bg-gray-400"
                >
                  <Moon className="w-3 h-3" />
                  <span>Hibernate</span>
                </button>
                <button
                  onClick={() => executeCommand('csb sandboxes shutdown')}
                  disabled={selectedSandboxes.size === 0 || !terminalSession?.isConnected}
                  className="flex items-center space-x-1 px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:bg-gray-400"
                >
                  <Power className="w-3 h-3" />
                  <span>Shutdown</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Terminal */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 flex items-center space-x-2">
                <TerminalIcon className="w-4 h-4" />
                <span>CLI Terminal</span>
              </h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={clearTerminal}
                  disabled={!terminalSession}
                  className="flex items-center space-x-1 px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 disabled:bg-gray-400"
                >
                  <X className="w-3 h-3" />
                  <span>Clear</span>
                </button>
                <button
                  onClick={restartTerminal}
                  className="flex items-center space-x-1 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Restart</span>
                </button>
              </div>
            </div>
          </div>
          
          <div className="p-4">
            {isCreatingSandbox || isConnectingTerminal ? (
              <div className="flex items-center justify-center h-96 bg-gray-50 rounded">
                <div className="text-center">
                  <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p className="text-gray-600">
                    {isCreatingSandbox ? 'Creating terminal sandbox...' : 'Connecting to terminal...'}
                  </p>
                </div>
              </div>
            ) : (
              <div 
                ref={terminalContainerRef}
                className="h-96 bg-black rounded overflow-hidden"
                style={{ 
                  minHeight: '384px',
                  width: '100%',
                  position: 'relative'
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Quick Commands */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Quick CLI Commands</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickCommands.map((cmd, index) => {
            const Icon = cmd.icon
            return (
              <button
                key={index}
                onClick={() => executeCommand(cmd.command)}
                disabled={!terminalSession?.isConnected}
                className="flex items-start space-x-3 p-4 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed text-left"
              >
                <Icon className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{cmd.label}</p>
                  <p className="text-xs text-gray-500 mt-1">{cmd.description}</p>
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded mt-2 inline-block">
                    {cmd.command}
                  </code>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
} 