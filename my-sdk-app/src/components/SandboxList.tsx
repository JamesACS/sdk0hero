import { useState } from 'react'
import { Plus, Play, Calendar, Lock, Globe, Eye, Settings, Filter, Search, X } from 'lucide-react'
import { clsx } from 'clsx'
import { type SandboxClient } from '../lib/codesandbox'

interface SandboxListProps {
  sandboxes: any[]
  isLoading: boolean
  onCreateSandbox: (params: CreateSandboxParams) => Promise<void>
  onConnectToSandbox: (sandbox: any) => Promise<SandboxClient | undefined>
}

interface CreateSandboxParams {
  title?: string
  description?: string
  templateId?: string
  privacy?: 'private' | 'unlisted' | 'public'
  tags?: string[]
  path?: string
  ipcountry?: string
  vmTier?: 'pico' | 'nano' | 'micro' | 'small' | 'medium' | 'large'
  hibernationTimeoutSeconds?: number
  automaticWakeupConfig?: {
    http: boolean
    websocket: boolean
  }
}

export function SandboxList({
  sandboxes,
  isLoading,
  onCreateSandbox,
  onConnectToSandbox
}: SandboxListProps) {
  const [isCreatingLocal, setIsCreatingLocal] = useState(false)
  const [showAdvancedForm, setShowAdvancedForm] = useState(false)
  
  // Advanced form state
  const [formData, setFormData] = useState<CreateSandboxParams>({
    privacy: 'unlisted',
    tags: [],
    ipcountry: 'US',
    vmTier: 'pico',
    hibernationTimeoutSeconds: 300,
    automaticWakeupConfig: {
      http: true,
      websocket: true
    }
  })

  // Filter state
  const [filters, setFilters] = useState({
    status: '',
    lastUpdated: '',
    search: ''
  })
  const [showFilters, setShowFilters] = useState(false)

  // Popular templates with their actual CodeSandbox IDs
  const templates = [
    { id: '', name: 'Blank', description: 'Start from scratch' },
    { id: '9qputt', name: 'React (TS)', description: 'Quickest way to get started with a React application! Uses Vite on the server.' },
    { id: 'fxis37', name: 'Next.js', description: 'The official Next.js template by the CodeSandbox team' },
    { id: 'pb6sit', name: 'Vue', description: 'Vue 3 set up using Vite' },
    { id: 'angular', name: 'Angular', description: 'The quickest way to get started with Angular!' },
    { id: 'k8dsq1', name: 'Node.js', description: 'The official Node.js template by the CodeSandbox team' },
    { id: 'pcz35m', name: 'Universal', description: 'A starter that contains almost all programming languages' },
    { id: 'hfzycq', name: 'React + Tailwind', description: 'React running on Vite with Tailwind integrated for styling' }
  ]

  const vmTiers = [
    { value: 'pico', label: 'Pico (0.5 vCPU, 1GB RAM)', description: 'Basic tier for light development' },
    { value: 'nano', label: 'Nano (1 vCPU, 2GB RAM)', description: 'Small projects and testing' },
    { value: 'micro', label: 'Micro (2 vCPU, 4GB RAM)', description: 'Medium projects' },
    { value: 'small', label: 'Small (4 vCPU, 8GB RAM)', description: 'Larger applications' },
    { value: 'medium', label: 'Medium (8 vCPU, 16GB RAM)', description: 'Complex applications' },
    { value: 'large', label: 'Large (16 vCPU, 32GB RAM)', description: 'Enterprise applications' }
  ]

  const countries = [
    { code: 'US', name: 'United States' },
    { code: 'EU', name: 'Europe' },
    { code: 'AP', name: 'Asia Pacific' }
  ]

  const handleCreateSandbox = async () => {
    setIsCreatingLocal(true)
    try {
      // Create enhanced sandbox with all options
      const createParams = {
        title: formData.title,
        description: formData.description,
        templateId: formData.templateId,
        privacy: formData.privacy,
        tags: formData.tags?.filter(tag => tag.trim()),
        path: formData.path,
        ipcountry: formData.ipcountry,
        vmTier: formData.vmTier,
        hibernationTimeoutSeconds: formData.hibernationTimeoutSeconds,
        automaticWakeupConfig: formData.automaticWakeupConfig
      }

      // Pass all the advanced parameters to the handler
      await onCreateSandbox(createParams)
      
      // Reset form
      setFormData({
        privacy: 'unlisted',
        tags: [],
        ipcountry: 'US',
        vmTier: 'pico',
        hibernationTimeoutSeconds: 300,
        automaticWakeupConfig: {
          http: true,
          websocket: true
        }
      })
      setShowAdvancedForm(false)
    } finally {
      setIsCreatingLocal(false)
    }
  }





  const getPrivacyIcon = (privacy: string) => {
    switch (privacy) {
      case 'private': return <Lock className="w-4 h-4" />
      case 'public': return <Globe className="w-4 h-4" />
      default: return <Eye className="w-4 h-4" />
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getSandboxStatus = (sandbox: any) => {
    // In a real implementation, this would check actual VM status via SDK
    // For now, simulate different statuses based on sandbox properties
    if (sandbox.title?.toLowerCase().includes('demo')) return 'hibernated'
    if (sandbox.privacy === 'public') return 'running'
    if (new Date(sandbox.updatedAt || sandbox.createdAt) > new Date(Date.now() - 24 * 60 * 60 * 1000)) return 'running'
    return 'idle'
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-green-100 text-green-800'
      case 'hibernated': return 'bg-blue-100 text-blue-800'
      case 'idle': return 'bg-gray-100 text-gray-800'
      case 'error': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  // Filter sandboxes based on current filters
  const filteredSandboxes = sandboxes.filter(sandbox => {
    // Status filter
    if (filters.status) {
      const status = getSandboxStatus(sandbox)
      if (status !== filters.status) return false
    }

    // Last updated filter (days)
    if (filters.lastUpdated) {
      const updatedDate = new Date(sandbox.updatedAt || sandbox.createdAt)
      const now = new Date()
      const daysDiff = Math.floor((now.getTime() - updatedDate.getTime()) / (1000 * 60 * 60 * 24))
      
      switch (filters.lastUpdated) {
        case 'today':
          if (daysDiff > 0) return false
          break
        case 'week':
          if (daysDiff > 7) return false
          break
        case 'month':
          if (daysDiff > 30) return false
          break
        case 'quarter':
          if (daysDiff > 90) return false
          break
      }
    }

    // Search filter (title and ID)
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase()
      const title = (sandbox.title || '').toLowerCase()
      const id = sandbox.id.toLowerCase()
      if (!title.includes(searchTerm) && !id.includes(searchTerm)) return false
    }

    return true
  })

  const updateFilter = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const clearFilters = () => {
    setFilters({
      status: '',
      lastUpdated: '',
      search: ''
    })
  }

  return (
    <div className="space-y-8">
      {/* Create New Sandbox Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Plus className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Create New Sandbox</h2>
          </div>
          <button
            onClick={() => setShowAdvancedForm(!showAdvancedForm)}
            className="flex items-center space-x-1 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded border border-blue-300"
          >
            <Settings className="w-4 h-4" />
            <span>{showAdvancedForm ? 'Simple' : 'Advanced'}</span>
          </button>
        </div>

        {showAdvancedForm ? (
          /* Advanced Form */
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={formData.title || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="My Awesome Project"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Template</label>
                <select
                  value={formData.templateId || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, templateId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe your project..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Privacy & Configuration */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Privacy</label>
                <select
                  value={formData.privacy || 'unlisted'}
                  onChange={(e) => setFormData(prev => ({ ...prev, privacy: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="private">Private</option>
                  <option value="unlisted">Unlisted</option>
                  <option value="public">Public</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">VM Tier</label>
                <select
                  value={formData.vmTier || 'pico'}
                  onChange={(e) => setFormData(prev => ({ ...prev, vmTier: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {vmTiers.map((tier) => (
                    <option key={tier.value} value={tier.value}>
                      {tier.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
                <select
                  value={formData.ipcountry || 'US'}
                  onChange={(e) => setFormData(prev => ({ ...prev, ipcountry: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {countries.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Advanced Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hibernation Timeout (seconds)
                </label>
                <input
                  type="number"
                  value={formData.hibernationTimeoutSeconds || 300}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    hibernationTimeoutSeconds: parseInt(e.target.value) || 300 
                  }))}
                  min={60}
                  max={86400}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Auto-wakeup</label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.automaticWakeupConfig?.http || false}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        automaticWakeupConfig: {
                          ...prev.automaticWakeupConfig,
                          http: e.target.checked,
                          websocket: prev.automaticWakeupConfig?.websocket || false
                        }
                      }))}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">HTTP requests</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.automaticWakeupConfig?.websocket || false}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        automaticWakeupConfig: {
                          ...prev.automaticWakeupConfig,
                          websocket: e.target.checked,
                          http: prev.automaticWakeupConfig?.http || false
                        }
                      }))}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">WebSocket connections</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleCreateSandbox}
                disabled={isCreatingLocal}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {isCreatingLocal ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Create Advanced Sandbox</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Simple Form */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                Title (Optional)
              </label>
              <input
                type="text"
                id="title"
                value={formData.title || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="My Awesome Project"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label htmlFor="template" className="block text-sm font-medium text-gray-700 mb-1">
                Template
              </label>
              <select
                id="template"
                value={formData.templateId || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, templateId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={handleCreateSandbox}
                disabled={isCreatingLocal}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {isCreatingLocal ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Create Sandbox</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {(formData.templateId && !showAdvancedForm) && (
          <div className="mt-3 p-3 bg-gray-50 rounded border text-sm text-gray-600">
            <strong>{templates.find(t => t.id === formData.templateId)?.name}:</strong>{' '}
            {templates.find(t => t.id === formData.templateId)?.description}
          </div>
        )}
      </div>

      {/* Existing Sandboxes */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-semibold text-gray-900">Your Sandboxes</h2>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center space-x-1 px-3 py-1 text-sm rounded-lg border transition-colors ${
                showFilters 
                  ? 'bg-blue-50 border-blue-300 text-blue-700' 
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Filter className="w-4 h-4" />
              <span>Filters</span>
              {(filters.status || filters.lastUpdated || filters.search) && (
                <span className="bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {[filters.status, filters.lastUpdated, filters.search].filter(Boolean).length}
                </span>
              )}
            </button>
          </div>
          <p className="text-gray-600">Connect to any of your existing sandboxes using the browser SDK</p>
        </div>

        {/* Filter Controls */}
        {showFilters && (
          <div className="p-6 bg-gray-50 border-b border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Search Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Search className="w-4 h-4 inline mr-1" />
                  Search
                </label>
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => updateFilter('search', e.target.value)}
                  placeholder="Search by title or ID..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => updateFilter('status', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Statuses</option>
                  <option value="running">Running</option>
                  <option value="idle">Idle</option>
                  <option value="hibernated">Hibernated</option>
                </select>
              </div>

              {/* Last Updated Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Last Updated
                </label>
                <select
                  value={filters.lastUpdated}
                  onChange={(e) => updateFilter('lastUpdated', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">Past Week</option>
                  <option value="month">Past Month</option>
                  <option value="quarter">Past 3 Months</option>
                </select>
              </div>
            </div>

            {/* Filter Actions */}
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-gray-600">
                Showing {filteredSandboxes.length} of {sandboxes.length} sandboxes
              </div>
              <button
                onClick={clearFilters}
                className="flex items-center space-x-1 px-3 py-1 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <X className="w-3 h-3" />
                <span>Clear Filters</span>
              </button>
            </div>
          </div>
        )}

        <div className="p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">Loading sandboxes...</span>
            </div>
          ) : sandboxes.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Plus className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No sandboxes yet</h3>
              <p className="text-gray-500 mb-4">Create your first sandbox to get started</p>
            </div>
          ) : filteredSandboxes.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No sandboxes match your filters</h3>
              <p className="text-gray-500 mb-4">Try adjusting your search criteria or clear the filters</p>
              <button
                onClick={clearFilters}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {filteredSandboxes.map((sandbox) => {
                const status = getSandboxStatus(sandbox)
                return (
                  <div
                    key={sandbox.id}
                    className={clsx(
                      "p-3 border rounded-lg transition-colors",
                      "hover:border-blue-300 hover:bg-blue-50"
                    )}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-gray-900 truncate">
                          {sandbox.title || 'Untitled Sandbox'}
                        </h3>
                        <p className="text-xs text-gray-500 truncate">
                          ID: {sandbox.id}
                        </p>
                      </div>
                      <div className="flex flex-col items-end space-y-1 ml-2">
                        <div className="flex items-center space-x-1">
                          {getPrivacyIcon(sandbox.privacy)}
                          <span className="text-xs text-gray-500 capitalize">
                            {sandbox.privacy}
                          </span>
                        </div>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
                          {status}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 text-xs text-gray-500 mb-3">
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-3 h-3" />
                        <span>Updated {formatDate(sandbox.updatedAt)}</span>
                      </div>
                    </div>

                    <div className="flex flex-col space-y-1">
                      <a
                        href={`https://codesandbox.io/p/devbox/${sandbox.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full text-center px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded border border-blue-300"
                      >
                        Open in CodeSandbox
                      </a>
                      <button
                        onClick={() => onConnectToSandbox(sandbox)}
                        className="w-full flex items-center justify-center space-x-1 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:bg-gray-400"
                      >
                        <Play className="w-3 h-3" />
                        <span>Connect SDK</span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>


    </div>
  )
}