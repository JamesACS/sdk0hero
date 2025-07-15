import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    // Enable process.env access in browser (needed for the SDK)
    'process.env': {},
    // Define global for compatibility
    global: 'globalThis',
  },
  resolve: {
    alias: {
      // Polyfill Node.js modules that might be needed
      buffer: 'buffer',
      process: 'process/browser',
      stream: 'stream-browserify',
      util: 'util',
    },
  },
  optimizeDeps: {
    // Pre-bundle the SDK and its dependencies for faster development
    include: [
      '@codesandbox/sdk',
      'buffer',
      'process',
      'stream-browserify',
      'util'
    ],
    // Exclude problematic modules from optimization
    exclude: []
  },
  build: {
    // Ensure compatibility with older browsers
    target: 'es2015',
    // Don't minify for easier debugging if needed
    minify: true,
    rollupOptions: {
      // Provide polyfills for Node.js modules
      plugins: [],
    }
  },
  server: {
    // Add CodeSandbox compatibility
    host: true,
    hmr: {
      port: 443,
    }
  }
})