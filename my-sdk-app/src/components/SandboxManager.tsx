import { useState, useEffect, useRef } from 'react'
import { 
  Terminal as TerminalIcon, 
  Play, 
  Square, 
  RotateCcw,
  ArrowLeft, 
  Monitor,
  List,
  Info,
  ExternalLink,
  Folder,
  File,
  Edit,
  Download,
  Upload,
  Copy,
  Trash2,
  Plus,
  Save,
  X,
  FolderPlus,
  Key,
  Clock,
  Link,
  Shield,
  Calendar,
  RefreshCw
} from 'lucide-react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { createPreview, createSDK } from '../lib/codesandbox'
import { type SandboxWithClient } from '../lib/codesandbox'

interface SandboxManagerProps {
  sandboxWithClient: SandboxWithClient
  onDisconnect: () => void
  apiKey: string
}

interface Task {
  id: string
  name: string
  command: string
  status: 'RUNNING' | 'FINISHED' | 'ERROR' | 'KILLED' | 'RESTARTING' | 'IDLE'
  runAtStart: boolean
}

interface FileItem {
  name: string
  type: 'file' | 'directory'
  path: string
  size?: number
}

export function SandboxManager({ sandboxWithClient, onDisconnect, apiKey }: SandboxManagerProps) {
  const { sandbox, client, isConnecting } = sandboxWithClient
  const [activeTab, setActiveTab] = useState<'terminal' | 'preview' | 'tasks' | 'files' | 'hosts'>('terminal')
  const [tasks, setTasks] = useState<Task[]>([])
  const [previewPort, setPreviewPort] = useState<number>(5173)
  const [availablePorts, setAvailablePorts] = useState<number[]>([])
  
  // File management state
  const [currentPath, setCurrentPath] = useState<string>('/project/workspace')
  const [files, setFiles] = useState<FileItem[]>([])
  const [isLoadingFiles, setIsLoadingFiles] = useState(false)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string>('')
  const [isEditingFile, setIsEditingFile] = useState(false)
  const [isSavingFile, setIsSavingFile] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createItemType, setCreateItemType] = useState<'file' | 'folder'>('file')
  const [createItemName, setCreateItemName] = useState('')
  
  // Host token management state
  const [hostTokens, setHostTokens] = useState<any[]>([])
  const [isLoadingTokens, setIsLoadingTokens] = useState(false)
  const [newTokenExpiration, setNewTokenExpiration] = useState('')
  const [isCreatingToken, setIsCreatingToken] = useState(false)
  const [generatedUrls, setGeneratedUrls] = useState<{[key: string]: string}>({})
  
  // Terminal refs
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  
  // Preview refs
  const previewRef = useRef<HTMLDivElement>(null)
  
  // File upload ref
  const fileUploadRef = useRef<HTMLInputElement>(null)

  // Initialize terminal
  useEffect(() => {
    if (!client || !terminalRef.current || xtermRef.current) return

    const initTerminal = async () => {
      try {
        // Create terminal instance
        const terminal = await client.terminals.create()
        const xterm = new Terminal({
          theme: {
            background: '#1e1e1e',
            foreground: '#ffffff',
            cursor: '#ffffff'
          },
          fontSize: 14,
          fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace'
        })
        
        const fitAddon = new FitAddon()
        xterm.loadAddon(fitAddon)
        
        xterm.open(terminalRef.current!)
        fitAddon.fit()
        
        // Get initial output and subscribe
        const output = await terminal.open()
        xterm.write(output)
        
        terminal.onOutput((output) => {
          xterm.write(output)
        })
        
        xterm.onData((data) => {
          terminal.write(data)
        })
        
        xtermRef.current = xterm
        fitAddonRef.current = fitAddon
        
        // Handle resize
        const handleResize = () => {
          if (fitAddonRef.current) {
            fitAddonRef.current.fit()
          }
        }
        
        window.addEventListener('resize', handleResize)
        
        return () => {
          window.removeEventListener('resize', handleResize)
          xterm.dispose()
        }
      } catch (error) {
        console.error('Failed to initialize terminal:', error)
      }
    }

    initTerminal()
  }, [client])

  // Handle terminal resize when switching to terminal tab
  useEffect(() => {
    if (activeTab === 'terminal' && xtermRef.current && fitAddonRef.current) {
      // Small delay to ensure the container is fully visible
      const timer = setTimeout(() => {
        try {
          fitAddonRef.current?.fit()
          xtermRef.current?.focus()
        } catch (error) {
          console.error('Failed to resize terminal:', error)
        }
      }, 100)
      
      return () => clearTimeout(timer)
    }
  }, [activeTab])

  // Load tasks
  useEffect(() => {
    if (!client) return

    const loadTasks = async () => {
      try {
        const allTasks = await client.tasks.getAll()
        setTasks(allTasks)
        
        // Get port information
        const ports: number[] = []
        for (const task of allTasks) {
          if (task.status === 'RUNNING') {
            try {
              const taskInstance = await client.tasks.get(task.id)
              if (taskInstance) {
                // Try to get port information
                const port = await taskInstance.waitForPort().catch(() => null)
                if (port && port.port) {
                  ports.push(port.port)
                }
              }
            } catch (e) {
              // Task might not have a port
            }
          }
        }
        setAvailablePorts(ports)
        
        // Update preview port based on available ports
        if (ports.length > 0) {
          // If we have running tasks with ports, use the first one
          // Prefer common dev server ports if available
          const preferredPort = ports.find(p => [3000, 5173, 8080, 4000].includes(p)) || ports[0]
          setPreviewPort(preferredPort)
        } else {
          // If no tasks are running with ports, default to 3000
          setPreviewPort(3000)
        }
      } catch (error) {
        console.error('Failed to load tasks:', error)
      }
    }

    loadTasks()
    
    // Refresh tasks every 5 seconds
    const interval = setInterval(loadTasks, 5000)
    return () => clearInterval(interval)
  }, [client])

  // Initialize preview
  useEffect(() => {
    if (!client || !previewRef.current || activeTab !== 'preview') return

    const initPreview = async () => {
      try {
        // Clear previous preview
        if (previewRef.current) {
          previewRef.current.innerHTML = ''
        }
        
        // Create preview for the specified port
        const url = client.hosts.getUrl(previewPort)
        const preview = createPreview(url)
        
        if (previewRef.current && preview.iframe) {
          preview.iframe.style.width = '100%'
          preview.iframe.style.height = '100%'
          preview.iframe.style.border = 'none'
          previewRef.current.appendChild(preview.iframe)
        }
      } catch (error) {
        console.error('Failed to create preview:', error)
      }
    }

    initPreview()
  }, [client, activeTab, previewPort])

  // Load files when path changes or when switching to files tab
  useEffect(() => {
    if (client && activeTab === 'files') {
      loadFiles(currentPath)
    }
  }, [client, currentPath, activeTab])

  // Load host tokens when switching to hosts tab
  useEffect(() => {
    if (client && activeTab === 'hosts') {
      loadHostTokens()
    }
  }, [client, activeTab])

  const runTask = async (taskId: string) => {
    if (!client) return
    
    try {
      const task = await client.tasks.get(taskId)
      if (task) {
        await task.run()
        // Refresh tasks after a short delay
        setTimeout(async () => {
          const allTasks = await client.tasks.getAll()
          setTasks(allTasks)
        }, 1000)
      }
    } catch (error) {
      console.error('Failed to run task:', error)
    }
  }

  const stopTask = async (taskId: string) => {
    if (!client) return
    
    try {
      const task = await client.tasks.get(taskId)
      if (task) {
        await task.stop()
        setTimeout(async () => {
          const allTasks = await client.tasks.getAll()
          setTasks(allTasks)
        }, 1000)
      }
    } catch (error) {
      console.error('Failed to stop task:', error)
    }
  }

  const restartTask = async (taskId: string) => {
    if (!client) return
    
    try {
      const task = await client.tasks.get(taskId)
      if (task) {
        await task.restart()
        setTimeout(async () => {
          const allTasks = await client.tasks.getAll()
          setTasks(allTasks)
        }, 1000)
      }
    } catch (error) {
      console.error('Failed to restart task:', error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RUNNING': return 'bg-green-100 text-green-800'
      case 'ERROR': return 'bg-red-100 text-red-800'
      case 'FINISHED': return 'bg-blue-100 text-blue-800'
      case 'IDLE': return 'bg-gray-100 text-gray-800'
      case 'KILLED': return 'bg-orange-100 text-orange-800'
      case 'RESTARTING': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  // File management functions
  const loadFiles = async (path: string) => {
    if (!client) return
    
    setIsLoadingFiles(true)
    try {
      const entries = await client.fs.readdir(path)
      const fileItems: FileItem[] = entries.map(entry => ({
        name: entry.name,
        type: entry.type,
        path: path === '/' ? `/${entry.name}` : `${path}/${entry.name}`,
        size: (entry as any).size
      }))
      
      // Sort: directories first, then files
      fileItems.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1
        }
        return a.name.localeCompare(b.name)
      })
      
      setFiles(fileItems)
    } catch (error) {
      console.error('Failed to load files:', error)
    } finally {
      setIsLoadingFiles(false)
    }
  }

  const readFileContent = async (filePath: string) => {
    if (!client) return
    
    try {
      const content = await client.fs.readTextFile(filePath)
      setFileContent(content)
      setSelectedFile(filePath)
      setIsEditingFile(true)
    } catch (error) {
      console.error('Failed to read file:', error)
      // Try reading as binary and convert to text
      try {
        const binaryContent = await client.fs.readFile(filePath)
        const decoder = new TextDecoder()
        const content = decoder.decode(binaryContent)
        setFileContent(content)
        setSelectedFile(filePath)
        setIsEditingFile(true)
      } catch (binaryError) {
        console.error('Failed to read file as binary:', binaryError)
      }
    }
  }

  const saveFileContent = async () => {
    if (!client || !selectedFile) return
    
    setIsSavingFile(true)
    try {
      await client.fs.writeTextFile(selectedFile, fileContent)
      console.log('File saved successfully')
    } catch (error) {
      console.error('Failed to save file:', error)
    } finally {
      setIsSavingFile(false)
    }
  }

  const createItem = async () => {
    if (!client || !createItemName.trim()) return
    
    const fullPath = currentPath === '/' ? `/${createItemName}` : `${currentPath}/${createItemName}`
    
    try {
      if (createItemType === 'file') {
        await client.fs.writeTextFile(fullPath, '')
      } else {
        // Create directory - we'll try to create a temporary file and then remove it
        const tempFile = `${fullPath}/.gitkeep`
        await client.fs.writeTextFile(tempFile, '')
      }
      
      // Refresh file list
      await loadFiles(currentPath)
      
      // Reset modal
      setShowCreateModal(false)
      setCreateItemName('')
    } catch (error) {
      console.error(`Failed to create ${createItemType}:`, error)
    }
  }

  const deleteItem = async (filePath: string) => {
    if (!client) return
    
    try {
      await client.fs.remove(filePath)
      await loadFiles(currentPath)
    } catch (error) {
      console.error('Failed to delete item:', error)
    }
  }

  const copyItem = async (sourcePath: string) => {
    if (!client) return
    
    const copyPath = `${sourcePath}-copy`
    
    try {
      await client.fs.copy(sourcePath, copyPath)
      await loadFiles(currentPath)
    } catch (error) {
      console.error('Failed to copy item:', error)
    }
  }

  const downloadItem = async (filePath: string) => {
    if (!client) return
    
    try {
      const { downloadUrl } = await client.fs.download(filePath)
      window.open(downloadUrl, '_blank')
    } catch (error) {
      console.error('Failed to download item:', error)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!client || !event.target.files?.length) return
    
    const file = event.target.files[0]
    const filePath = currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`
    
    try {
      const arrayBuffer = await file.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      await client.fs.writeFile(filePath, uint8Array)
      await loadFiles(currentPath)
    } catch (error) {
      console.error('Failed to upload file:', error)
    }
    
    // Reset input
    if (fileUploadRef.current) {
      fileUploadRef.current.value = ''
    }
  }

  const navigateToPath = (path: string) => {
    setCurrentPath(path)
    setSelectedFile(null)
    setIsEditingFile(false)
  }

  const navigateUp = () => {
    if (currentPath !== '/') {
      const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/'
      navigateToPath(parentPath)
    }
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return ''
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
  }

  // Host token management functions
  const loadHostTokens = async () => {
    if (!client || !sandbox?.id) return
    
    setIsLoadingTokens(true)
    try {
      const sdk = createSDK(apiKey)
      const tokens = await sdk.hosts.listTokens(sandbox.id)
      
      // Transform the tokens to match our UI format
      const formattedTokens = tokens.map((token: any) => ({
        id: token.id,
        token: token.token,
        expiresAt: token.expiresAt,
        createdAt: token.createdAt,
      }))
      
      setHostTokens(formattedTokens)
    } catch (error) {
      console.error('Failed to load host tokens:', error)
      // Show user-friendly error
      setHostTokens([])
    } finally {
      setIsLoadingTokens(false)
    }
  }

  const createHostToken = async () => {
    if (!client || !newTokenExpiration || !sandbox?.id) return
    
    setIsCreatingToken(true)
    try {
      const sdk = createSDK(apiKey)
      const token = await sdk.hosts.createToken(sandbox.id, {
        expiresAt: new Date(newTokenExpiration)
      })
      
      // Add the new token to our list
      const formattedToken = {
        id: (token as any).id || `token_${Date.now()}`,
        token: token.token,
        expiresAt: newTokenExpiration,
        createdAt: new Date().toISOString(),
      }
      
      setHostTokens(prev => [formattedToken, ...prev])
      setNewTokenExpiration('')
    } catch (error) {
      console.error('Failed to create host token:', error)
      // You might want to show a user notification here
    } finally {
      setIsCreatingToken(false)
    }
  }

  const revokeToken = async (tokenId: string) => {
    if (!client || !sandbox?.id) return
    
    try {
      const sdk = createSDK(apiKey)
      await sdk.hosts.revokeToken(sandbox.id, tokenId)
      
      // Remove from local state on success
      setHostTokens(prev => prev.filter(token => token.id !== tokenId))
    } catch (error) {
      console.error('Failed to revoke token:', error)
      // You might want to show a user notification here
    }
  }

  const revokeAllTokens = async () => {
    if (!client || !sandbox?.id) return
    
    try {
      const sdk = createSDK(apiKey)
      await sdk.hosts.revokeAllTokens(sandbox.id)
      
      // Clear local state on success
      setHostTokens([])
    } catch (error) {
      console.error('Failed to revoke all tokens:', error)
      // You might want to show a user notification here
    }
  }

  const generateSignedUrl = (token: any, port: number = 3000) => {
    try {
      const sdk = createSDK(apiKey)
      const url = sdk.hosts.getUrl(token.token, port)
      
      setGeneratedUrls(prev => ({
        ...prev,
        [`${token.id}_${port}`]: url
      }))
      return url
    } catch (error) {
      console.error('Failed to generate signed URL:', error)
      // Fallback to basic URL format
      const fallbackUrl = `https://${sandbox?.id}-${port}.csb.app?token=${token.token}`
      setGeneratedUrls(prev => ({
        ...prev,
        [`${token.id}_${port}`]: fallbackUrl
      }))
      return fallbackUrl
    }
  }

  const updateTokenExpiration = async (tokenId: string, newExpiration: string) => {
    if (!client || !sandbox?.id) return
    
    try {
      const sdk = createSDK(apiKey)
      await sdk.hosts.updateToken(sandbox.id, tokenId, new Date(newExpiration))
      
      // Update local state on success
      setHostTokens(prev => prev.map(token => 
        token.id === tokenId 
          ? { ...token, expiresAt: newExpiration }
          : token
      ))
    } catch (error) {
      console.error('Failed to update token expiration:', error)
      // You might want to show a user notification here
    }
  }

  const formatTokenDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (isConnecting) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Connecting to sandbox...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={onDisconnect}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Sandboxes</span>
              </button>
              
              <div className="border-l border-gray-300 pl-4">
                <h1 className="text-xl font-semibold text-gray-900">
                  {(sandbox as any)?.title || 'Untitled Sandbox'}
                </h1>
                <p className="text-sm text-gray-500">ID: {sandbox?.id}</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Connected via Browser SDK</span>
              </div>
              
              <a
                href={`https://codesandbox.io/p/devbox/${sandbox?.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded border border-blue-300"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open in CodeSandbox</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('terminal')}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                activeTab === 'terminal'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <TerminalIcon className="w-4 h-4" />
              <span>Terminal</span>
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                activeTab === 'preview'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Monitor className="w-4 h-4" />
              <span>Preview</span>
            </button>
            <button
              onClick={() => setActiveTab('tasks')}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                activeTab === 'tasks'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <List className="w-4 h-4" />
              <span>Tasks ({tasks.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('files')}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                activeTab === 'files'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Folder className="w-4 h-4" />
              <span>Files</span>
            </button>
            <button
              onClick={() => setActiveTab('hosts')}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                activeTab === 'hosts'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Key className="w-4 h-4" />
              <span>Host Tokens</span>
            </button>
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'terminal' && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                <TerminalIcon className="w-5 h-5" />
                <span>Terminal</span>
              </h2>
              <p className="text-sm text-gray-500">Interactive terminal session</p>
            </div>
            <div 
              ref={terminalRef} 
              className="h-96 bg-black rounded border"
              style={{ minHeight: '400px' }}
            />
          </div>
        )}

        {activeTab === 'preview' && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                <Monitor className="w-5 h-5" />
                <span>Preview</span>
              </h2>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <label className="text-sm text-gray-700">Port:</label>
                  {availablePorts.length > 0 ? (
                    <select
                      value={previewPort}
                      onChange={(e) => setPreviewPort(Number(e.target.value))}
                      className="px-2 py-1 text-sm border border-gray-300 rounded"
                    >
                      {availablePorts.map(port => (
                        <option key={port} value={port}>{port}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-1 text-sm text-gray-500 bg-gray-100 rounded">
                        No running tasks with ports
                      </span>
                      <input
                        type="number"
                        value={previewPort}
                        onChange={(e) => setPreviewPort(Number(e.target.value))}
                        placeholder="Enter port"
                        className="w-20 px-2 py-1 text-sm border border-gray-300 rounded"
                        min="1"
                        max="65535"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="relative">
              <div 
                ref={previewRef} 
                className="h-96 bg-gray-100 rounded border"
                style={{ minHeight: '600px' }}
              />
              {availablePorts.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-50 rounded border">
                  <div className="text-center">
                    <Monitor className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Preview Available</h3>
                    <p className="text-gray-500 mb-4">No tasks are currently running with web servers.</p>
                    <div className="text-sm text-gray-400">
                      <p>To preview your application:</p>
                      <p>1. Go to the <strong>Tasks</strong> tab</p>
                      <p>2. Run a development server (e.g., npm run dev)</p>
                      <p>3. Return here to see the preview</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                <List className="w-5 h-5" />
                <span>Available Tasks</span>
              </h2>
              
              {tasks.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No tasks found in this sandbox</p>
              ) : (
                <div className="space-y-3">
                  {tasks.map((task) => (
                    <div key={task.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h3 className="font-medium text-gray-900">{task.name}</h3>
                            <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(task.status)}`}>
                              {task.status}
                            </span>
                            {task.runAtStart && (
                              <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full">
                                Auto-start
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 font-mono">{task.command}</p>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => runTask(task.id)}
                            disabled={task.status === 'RUNNING'}
                            className="flex items-center space-x-1 px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:bg-gray-400"
                          >
                            <Play className="w-3 h-3" />
                            <span>Run</span>
                          </button>
                          
                          <button
                            onClick={() => restartTask(task.id)}
                            disabled={task.status !== 'RUNNING'}
                            className="flex items-center space-x-1 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:bg-gray-400"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Restart</span>
                          </button>
                          
                          <button
                            onClick={() => stopTask(task.id)}
                            disabled={task.status !== 'RUNNING'}
                            className="flex items-center space-x-1 px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:bg-gray-400"
                          >
                            <Square className="w-3 h-3" />
                            <span>Stop</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'files' && (
          <div className="space-y-6">
            {/* File Management Toolbar */}
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                  <Folder className="w-5 h-5" />
                  <span>File Manager</span>
                </h2>
                <div className="flex items-center space-x-2">
                  <input
                    type="file"
                    ref={fileUploadRef}
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileUploadRef.current?.click()}
                    className="flex items-center space-x-1 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Upload</span>
                  </button>
                  <button
                    onClick={() => {
                      setCreateItemType('file')
                      setShowCreateModal(true)
                    }}
                    className="flex items-center space-x-1 px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                  >
                    <Plus className="w-4 h-4" />
                    <span>New File</span>
                  </button>
                  <button
                    onClick={() => {
                      setCreateItemType('folder')
                      setShowCreateModal(true)
                    }}
                    className="flex items-center space-x-1 px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700"
                  >
                    <FolderPlus className="w-4 h-4" />
                    <span>New Folder</span>
                  </button>
                </div>
              </div>

              {/* Current Path */}
              <div className="flex items-center space-x-2 text-sm text-gray-600 mb-4">
                <span>Path:</span>
                <span className="font-mono bg-gray-100 px-2 py-1 rounded">{currentPath}</span>
                {currentPath !== '/' && (
                  <button
                    onClick={navigateUp}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    Go Up
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* File Browser */}
              <div className="bg-white rounded-lg shadow">
                <div className="p-4 border-b border-gray-200">
                  <h3 className="font-semibold text-gray-900">Files & Directories</h3>
                </div>
                <div className="p-4 max-h-96 overflow-y-auto">
                  {isLoadingFiles ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      <span className="ml-2 text-gray-600">Loading files...</span>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {files.map((file) => (
                        <div
                          key={file.path}
                          className="flex items-center justify-between p-2 hover:bg-gray-50 rounded group"
                        >
                          <button
                            onClick={() => {
                              if (file.type === 'directory') {
                                navigateToPath(file.path)
                              } else {
                                readFileContent(file.path)
                              }
                            }}
                            className="flex items-center space-x-2 flex-1 text-left"
                          >
                            {file.type === 'directory' ? (
                              <Folder className="w-4 h-4 text-blue-600" />
                            ) : (
                              <File className="w-4 h-4 text-gray-600" />
                            )}
                            <span className="truncate">{file.name}</span>
                            {file.size && (
                              <span className="text-xs text-gray-500 ml-auto">
                                {formatFileSize(file.size)}
                              </span>
                            )}
                          </button>
                          
                          <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {file.type === 'file' && (
                              <button
                                onClick={() => readFileContent(file.path)}
                                className="p-1 text-gray-400 hover:text-blue-600"
                                title="Edit"
                              >
                                <Edit className="w-3 h-3" />
                              </button>
                            )}
                            <button
                              onClick={() => copyItem(file.path)}
                              className="p-1 text-gray-400 hover:text-green-600"
                              title="Copy"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => downloadItem(file.path)}
                              className="p-1 text-gray-400 hover:text-blue-600"
                              title="Download"
                            >
                              <Download className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => deleteItem(file.path)}
                              className="p-1 text-gray-400 hover:text-red-600"
                              title="Delete"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                      
                      {files.length === 0 && !isLoadingFiles && (
                        <div className="text-center text-gray-500 py-8">
                          Directory is empty
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* File Editor */}
              <div className="bg-white rounded-lg shadow">
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">
                      {selectedFile ? `Editing: ${selectedFile.split('/').pop()}` : 'File Editor'}
                    </h3>
                    {isEditingFile && (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={saveFileContent}
                          disabled={isSavingFile}
                          className="flex items-center space-x-1 px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:bg-gray-400"
                        >
                          <Save className="w-3 h-3" />
                          <span>{isSavingFile ? 'Saving...' : 'Save'}</span>
                        </button>
                        <button
                          onClick={() => {
                            setIsEditingFile(false)
                            setSelectedFile(null)
                            setFileContent('')
                          }}
                          className="flex items-center space-x-1 px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
                        >
                          <X className="w-3 h-3" />
                          <span>Close</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="p-4">
                  {isEditingFile ? (
                    <textarea
                      value={fileContent}
                      onChange={(e) => setFileContent(e.target.value)}
                      className="w-full h-80 p-3 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="File content..."
                    />
                  ) : (
                    <div className="flex items-center justify-center h-80 text-gray-500">
                      <div className="text-center">
                        <File className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        <p>Select a file to edit</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Create Item Modal */}
            {showCreateModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 w-96">
                  <h3 className="text-lg font-semibold mb-4">
                    Create New {createItemType === 'file' ? 'File' : 'Folder'}
                  </h3>
                  <input
                    type="text"
                    value={createItemName}
                    onChange={(e) => setCreateItemName(e.target.value)}
                    placeholder={`${createItemType === 'file' ? 'File' : 'Folder'} name`}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-4"
                    onKeyDown={(e) => e.key === 'Enter' && createItem()}
                  />
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => {
                        setShowCreateModal(false)
                        setCreateItemName('')
                      }}
                      className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={createItem}
                      disabled={!createItemName.trim()}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                    >
                      Create
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'hosts' && (
          <div className="space-y-6">
            {/* Host Token Management Header */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                  <Key className="w-5 h-5" />
                  <span>Host Token Management</span>
                </h2>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={loadHostTokens}
                    disabled={isLoadingTokens}
                    className="flex items-center space-x-1 px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoadingTokens ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                  <button
                    onClick={revokeAllTokens}
                    disabled={hostTokens.length === 0}
                    className="flex items-center space-x-1 px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400"
                  >
                    <X className="w-4 h-4" />
                    <span>Revoke All</span>
                  </button>
                </div>
              </div>

              <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
                <div className="flex">
                  <Info className="w-5 h-5 text-blue-400 mr-2" />
                  <div>
                    <p className="text-sm text-blue-700">
                      <strong>Host Tokens:</strong> Create secure tokens for private sandbox access with expiration dates. Generate signed URLs for controlled access to your sandbox.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Token Creation Panel */}
              <div className="bg-white rounded-lg shadow">
                <div className="p-4 border-b border-gray-200">
                  <h3 className="font-semibold text-gray-900 flex items-center space-x-2">
                    <Plus className="w-4 h-4" />
                    <span>Create New Token</span>
                  </h3>
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Expiration Date
                    </label>
                    <input
                      type="datetime-local"
                      value={newTokenExpiration}
                      onChange={(e) => setNewTokenExpiration(e.target.value)}
                      min={new Date().toISOString().slice(0, 16)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <button
                    onClick={createHostToken}
                    disabled={!newTokenExpiration || isCreatingToken}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
                  >
                    <Key className="w-4 h-4" />
                    <span>{isCreatingToken ? 'Creating...' : 'Create Token'}</span>
                  </button>

                  {/* Quick presets */}
                  <div className="border-t pt-4">
                    <p className="text-sm text-gray-700 mb-2">Quick presets:</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setNewTokenExpiration(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16))}
                        className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded"
                      >
                        7 days
                      </button>
                      <button
                        onClick={() => setNewTokenExpiration(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16))}
                        className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded"
                      >
                        30 days
                      </button>
                      <button
                        onClick={() => setNewTokenExpiration(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16))}
                        className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded"
                      >
                        90 days
                      </button>
                      <button
                        onClick={() => setNewTokenExpiration(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16))}
                        className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded"
                      >
                        1 year
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* URL Generation Panel */}
              <div className="bg-white rounded-lg shadow">
                <div className="p-4 border-b border-gray-200">
                  <h3 className="font-semibold text-gray-900 flex items-center space-x-2">
                    <Link className="w-4 h-4" />
                    <span>Generate Signed URLs</span>
                  </h3>
                </div>
                <div className="p-4 space-y-4">
                  {hostTokens.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No tokens available. Create a token to generate URLs.
                    </p>
                                     ) : (
                     <div>
                       <label className="block text-sm font-medium text-gray-700 mb-2">
                         Select Token & Port
                       </label>
                       {hostTokens.map((token) => (
                         <div key={token.id} className="mb-3 p-3 border border-gray-200 rounded-lg">
                           <div className="flex items-center justify-between mb-2">
                             <span className="text-xs font-mono text-gray-600 truncate">
                               {token.token}
                             </span>
                             <span className="text-xs text-gray-500">
                               Expires: {formatTokenDate(token.expiresAt)}
                             </span>
                           </div>
                           <div className="flex space-x-2">
                             {[3000, 5173, 8080].map((port) => (
                               <button
                                 key={port}
                                 onClick={() => generateSignedUrl(token, port)}
                                 className="text-xs px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded"
                               >
                                 Port {port}
                               </button>
                             ))}
                           </div>
                           {generatedUrls[`${token.id}_3000`] && (
                             <div className="mt-2 p-2 bg-gray-50 rounded">
                               <p className="text-xs text-gray-600 mb-1">Generated URL:</p>
                               <code className="text-xs text-blue-600 break-all">
                                 {generatedUrls[`${token.id}_3000`]}
                               </code>
                             </div>
                           )}
                         </div>
                       ))}
                     </div>
                   )}
                </div>
              </div>
            </div>

            {/* Token Management Table */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900 flex items-center space-x-2">
                  <Shield className="w-4 h-4" />
                  <span>Active Tokens ({hostTokens.length})</span>
                </h3>
              </div>
              <div className="p-4">
                {isLoadingTokens ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    <span className="ml-2 text-gray-600">Loading tokens...</span>
                  </div>
                ) : hostTokens.length === 0 ? (
                  <div className="text-center py-8">
                    <Key className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500">No host tokens created yet</p>
                    <p className="text-sm text-gray-400">Create your first token to enable private access</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Token
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Created
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Expires
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {hostTokens.map((token) => (
                          <tr key={token.id} className="hover:bg-gray-50">
                            <td className="px-4 py-4 whitespace-nowrap">
                              <code className="text-sm font-mono text-gray-900 bg-gray-100 px-2 py-1 rounded">
                                {token.token}
                              </code>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                              <div className="flex items-center space-x-1">
                                <Calendar className="w-3 h-3" />
                                <span>{formatTokenDate(token.createdAt)}</span>
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                              <div className="flex items-center space-x-1">
                                <Clock className="w-3 h-3" />
                                <span>{formatTokenDate(token.expiresAt)}</span>
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => {
                                    const newExpiration = prompt('New expiration (YYYY-MM-DDTHH:MM):', token.expiresAt.slice(0, 16))
                                    if (newExpiration) {
                                      updateTokenExpiration(token.id, newExpiration)
                                    }
                                  }}
                                  className="text-blue-600 hover:text-blue-800"
                                  title="Update expiration"
                                >
                                  <Edit className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => revokeToken(token.id)}
                                  className="text-red-600 hover:text-red-800"
                                  title="Revoke token"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}