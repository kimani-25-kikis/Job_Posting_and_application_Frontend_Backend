import { type Context } from 'hono';
import { AuthService } from '../auth/auth.services.ts';

export class AuthController {
  // Register new user
  static async register(c: Context) {
    try {
      const { email, password, name, user_type } = await c.req.json();

      // Validation
      if (!email || !password || !name || !user_type) {
        return c.json({ 
          success: false,
          error: 'All fields are required' 
        }, 400);
      }

      if (!['employer', 'employee'].includes(user_type)) {
        return c.json({ 
          success: false,
          error: 'User type must be employer or employee' 
        }, 400);
      }

      if (password.length < 6) {
        return c.json({ 
          success: false,
          error: 'Password must be at least 6 characters' 
        }, 400);
      }

      const result = await AuthService.register(email, password, name, user_type as 'employer' | 'employee');
      
      return c.json({
        success: true,
        message: 'User registered successfully',
        data: result
      }, 201);

    } catch (error: any) {
      console.error('Registration error:', error);
      
      if (error.message.includes('already exists')) {
        return c.json({ 
          success: false,
          error: error.message 
        }, 409);
      }
      
      return c.json({ 
        success: false,
        error: 'Registration failed' 
      }, 500);
    }
  }

  // Login user
  static async login(c: Context) {
    try {
      const { email, password } = await c.req.json();

      // Validation
      if (!email || !password) {
        return c.json({ 
          success: false,
          error: 'Email and password are required' 
        }, 400);
      }

      const result = await AuthService.login(email, password);
      
      return c.json({
        success: true,
        message: 'Login successful',
        data: result
      });

    } catch (error: any) {
      console.error('Login error:', error);
      
      if (error.message.includes('Invalid email or password')) {
        return c.json({ 
          success: false,
          error: error.message 
        }, 401);
      }
      
      return c.json({ 
        success: false,
        error: 'Login failed' 
      }, 500);
    }
  }

  // Get current user profile
  static async getProfile(c: Context) {
    try {
      const authHeader = c.req.header('Authorization');
      
      console.log('Authorization Header:', authHeader); // Debug log

      const decoded = AuthService.extractAndVerifyToken(authHeader);
      console.log('Decoded token:', decoded); // Debug log

      const user = await AuthService.getUserById(decoded.userId);
      
      if (!user) {
        return c.json({ 
          success: false,
          error: 'User not found' 
        }, 404);
      }

      return c.json({
        success: true,
        message: 'Profile retrieved successfully',
        data: { user }
      });

    } catch (error: any) {
      console.error('Get profile error:', error);
      
      return c.json({ 
        success: false,
        error: error.message 
      }, 401);
    }
  }
}