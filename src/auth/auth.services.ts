import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import sql from 'mssql';
import { getDbPool } from '../db/db.config.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'nexus-jobs-secret-key';

export interface User {
  id: number;
  email: string;
  name: string;
  user_type: 'employer' | 'employee';
  created_at: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface DecodedToken {
  userId: number;
  userType: string;
  email: string;
  iat?: number;
  exp?: number;
}

export class AuthService {
  // Register new user
  static async register(
    email: string, 
    password: string, 
    name: string, 
    user_type: 'employer' | 'employee'
  ): Promise<AuthResponse> {
    const pool = getDbPool();
    
    // Check if user already exists
    const existingUser = await pool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT id FROM Users WHERE email = @email');
    
    if (existingUser.recordset.length > 0) {
      throw new Error('User with this email already exists');
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Create user
    const result = await pool.request()
      .input('email', sql.NVarChar, email)
      .input('password', sql.NVarChar, hashedPassword)
      .input('name', sql.NVarChar, name)
      .input('user_type', sql.NVarChar, user_type)
      .query(`
        INSERT INTO Users (email, password, name, user_type) 
        OUTPUT INSERTED.id, INSERTED.email, INSERTED.name, INSERTED.user_type, INSERTED.created_at
        VALUES (@email, @password, @name, @user_type)
      `);
    
    const user = result.recordset[0] as User;
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        userType: user.user_type,
        email: user.email 
      }, 
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    return { user, token };
  }

  // Login user
  static async login(email: string, password: string): Promise<AuthResponse> {
    const pool = getDbPool();
    
    const result = await pool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT * FROM Users WHERE email = @email');
    
    if (result.recordset.length === 0) {
      throw new Error('Invalid email or password');
    }
    
    const user = result.recordset[0];
    
    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      throw new Error('Invalid email or password');
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        userType: user.user_type,
        email: user.email 
      }, 
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    return { 
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        user_type: user.user_type,
        created_at: user.created_at
      }, 
      token 
    };
  }

  // Get user by ID
  static async getUserById(userId: number): Promise<User | null> {
    const pool = getDbPool();
    
    const result = await pool.request()
      .input('userId', sql.Int, userId)
      .query('SELECT id, email, name, user_type, created_at FROM Users WHERE id = @userId');
    
    return result.recordset.length > 0 ? (result.recordset[0] as User) : null;
  }

  // Extract and verify JWT token
  static extractAndVerifyToken(authHeader: string | undefined): DecodedToken {
    if (!authHeader) {
      throw new Error('No token provided');
    }

    // Check if header starts with 'Bearer '
    if (!authHeader.startsWith('Bearer ')) {
      throw new Error('Invalid token format. Expected: Bearer <token>');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
      throw new Error('Token is empty');
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as DecodedToken;
      return decoded;
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token has expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      } else {
        throw new Error('Token verification failed');
      }
    }
  }
}