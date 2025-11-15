import { Hono } from 'hono';
import { AuthController } from '../auth/auth.controllers.ts';

const authRoutes = new Hono();

authRoutes.get('/auth/debug-headers', (c) => {
  const authHeader = c.req.header('Authorization');
  const allHeaders = Object.fromEntries(c.req.raw.headers);
  
  return c.json({
    success: true,
    authHeader,
    allHeaders
  });
});

// Register new user
authRoutes.post('/auth/register', AuthController.register);

// Login user
authRoutes.post('/auth/login', AuthController.login);

// Get current user profile
authRoutes.get('/auth/profile', AuthController.getProfile);

export default authRoutes;