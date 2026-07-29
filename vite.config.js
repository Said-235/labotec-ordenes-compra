import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { handleAdminRequest } from './src/server/dispatchAdmin.js'

function adminApiPlugin() {
  return {
    name: 'labotec-admin-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (
          !req.url?.startsWith('/api/admin') &&
          !req.url?.startsWith('/.netlify/functions/admin')
        ) {
          return next()
        }

        if (req.method === 'OPTIONS') {
          res.statusCode = 204
          res.end()
          return
        }

        if (req.method !== 'POST') {
          res.statusCode = 405
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Método no permitido' }))
          return
        }

        try {
          const chunks = []
          for await (const chunk of req) chunks.push(chunk)
          const raw = Buffer.concat(chunks).toString('utf8')
          const parsed = raw ? JSON.parse(raw) : {}

          const result = await handleAdminRequest({
            authHeader: req.headers.authorization,
            action: parsed.action,
            payload: parsed.payload,
          })

          res.statusCode = result.status
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(result.body))
        } catch {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Error interno del servidor' }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Exponer al middleware Node (sin prefijo VITE_ para service role)
  process.env.SUPABASE_URL = process.env.SUPABASE_URL || env.SUPABASE_URL || env.VITE_SUPABASE_URL
  process.env.SUPABASE_ANON_KEY =
    process.env.SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY
  process.env.SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY

  return {
    plugins: [react(), tailwindcss(), adminApiPlugin()],
  }
})
