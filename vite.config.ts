/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { URL } from 'url'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const kayleeProxyTarget = env.VITE_KAYLEE_PROXY_TARGET || 'http://localhost:8090'
  const devApiProxyTarget = env.VITE_DEV_API_PROXY_TARGET || 'https://central-dev.fourdogspetsupplies.com'
  const appApiProxyTarget = env.VITE_API_PROXY_TARGET || devApiProxyTarget

  return {
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test-setup.ts',
      coverage: {
        provider: 'v8',
        reporter: ['text', 'lcov'],
      },
    },
    plugins: [tailwindcss(), react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      proxy: {
        '/auth': {
          target: appApiProxyTarget,
          changeOrigin: true,
          secure: false,
        },
        '/v1': {
          target: appApiProxyTarget,
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq, req) => {
              const forwardedSession = req.headers['x-dev-session-id']
              let sessionId = typeof forwardedSession === 'string' ? forwardedSession.trim() : ''

              if (!sessionId && req.url) {
                const parsed = new URL(req.url, 'http://localhost')
                const sid = parsed.searchParams.get('sid')
                if (sid) sessionId = sid.trim()
              }

              if (sessionId) {
                proxyReq.setHeader('Cookie', `session_id=${sessionId}`)
              }
              proxyReq.removeHeader('x-dev-session-id')
            })
          },
        },
        '/kaylee': {
          target: kayleeProxyTarget,
          changeOrigin: true,
          rewrite: (pathName) => pathName.replace(/^\/kaylee/, ''),
        },
        '/dev-api': {
          target: devApiProxyTarget,
          changeOrigin: true,
          secure: false,
          rewrite: (pathName) => pathName.replace(/^\/dev-api/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq, req) => {
              const forwardedSession = req.headers['x-dev-session-id']
              let sessionId = typeof forwardedSession === 'string' ? forwardedSession.trim() : ''

              if (!sessionId && req.url) {
                const parsed = new URL(req.url, 'http://localhost')
                const sid = parsed.searchParams.get('sid')
                if (sid) sessionId = sid.trim()
              }

              if (sessionId) {
                proxyReq.setHeader('Cookie', `session_id=${sessionId}`)
              }
              proxyReq.removeHeader('x-dev-session-id')
            })
          },
        },
      },
    },
  }
})
