import { serve } from '@hono/node-server'
import { type Context, Hono } from 'hono'
import { limiter } from './middleware/rateLimiter.ts'
import { cors } from 'hono/cors'
import initDatabaseConnection from './db/db.config.ts'
import { logger } from 'hono/logger'
import { prometheus } from '@hono/prometheus'
import authRoutes from './auth/auth.routes.ts'
import jobRoutes from './job/job.routes.ts'
import applicationRoutes from './application/application.routes.ts'

const app = new Hono()

// ✅ Enable CORS for frontend
app.use(
  '*',
  cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept', 'X-Requested-With'],
    exposeHeaders: ['Authorization', 'Content-Length'],
    credentials: true,
    maxAge: 86400,
  })
)

// Apply logger middleware
app.use('*', logger())

// Apply rate limiter middleware
// app.use(limiter)

// Root endpoint
app.get('/', (c) => {
  return c.json({
    success: true,
    message: 'Nexus Jobs API',
    timestamp: new Date().toISOString()
  })
})

// API routes
app.get('/api', (c: Context) => {
  return c.json({
    success: true,
    message: 'Welcome to Nexus Jobs API',
  }, 200)
})

// ✅ FIX: Mount routes correctly - remove the extra path segments
app.route('/api', authRoutes)
app.route('/api', jobRoutes) // Changed from '/api/jobs'
app.route('/api', applicationRoutes) // Changed from '/api/applications'

// 404 handler
app.notFound((c: Context) => {
  return c.json({
    success: false,
    message: 'Route not found',
    path: c.req.path,
  }, 404)
})

// Global error handler
app.onError((err, c) => {
  console.error('Server error:', err)
  return c.json({
    success: false,
    message: 'Internal server error'
  }, 500)
})

// Start server after DB connection
const port = Number(process.env.PORT) || 3001

initDatabaseConnection()
  .then(() => {
    serve(
      {
        fetch: app.fetch,
        port,
      },
      (info) => {
        console.log(`🚀 Nexus Jobs API running on http://localhost:${info.port}`)
      }
    )
  })
  .catch((error) => {
    console.error('Failed to initialize database connection:', error)
    process.exit(1)
  })

export default app