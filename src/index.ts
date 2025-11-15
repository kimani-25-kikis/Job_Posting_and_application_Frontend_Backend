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
import uploadRoutes from './upload/upload.routes.ts'
import fs from 'fs'
import path from 'path'

const app = new Hono()

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(process.cwd(), 'uploads', 'resumes')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
  console.log('Created uploads directory:', uploadsDir)
}

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

// ✅ Add custom route for serving resume files
app.get('/uploads/resumes/:filename', async (c) => {
  const filename = c.req.param('filename')
  
  // Security: Validate filename to prevent directory traversal
  if (!filename || filename.includes('..') || filename.includes('/')) {
    return c.json({ error: 'Invalid filename' }, 400)
  }

  const filePath = path.join(uploadsDir, filename)
  
  console.log('Trying to serve file:', filePath)
  
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.log('File not found:', filePath)
      return c.json({ error: 'File not found' }, 404)
    }

    // Get file stats
    const fileStats = fs.statSync(filePath)
    
    // Determine content type based on file extension
    const ext = path.extname(filename).toLowerCase()
    const contentTypes: { [key: string]: string } = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    }
    
    const contentType = contentTypes[ext] || 'application/octet-stream'
    
    // Read file and send as response
    const fileBuffer = fs.readFileSync(filePath)
    
    return new Response(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileStats.size.toString(),
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache'
      }
    })
  } catch (error) {
    console.error('Error serving file:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

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

// ✅ Mount API routes
app.route('/api', authRoutes)
app.route('/api', jobRoutes)
app.route('/api', applicationRoutes)
app.route('/api', uploadRoutes)

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
        console.log(`📁 Resume downloads: http://localhost:${info.port}/uploads/resumes/`)
      }
    )
  })
  .catch((error) => {
    console.error('Failed to initialize database connection:', error)
    process.exit(1)
  })

export default app