// Load environment variables automatically
import "dotenv/config";
import type { Context, Next } from "hono";
import jwt from "jsonwebtoken";

interface DecodedToken {
    userId: number;           
    userType: 'employer' | 'employee'; 
    email: string;             
    iat?: number;             
    exp?: number;              
}

type UserRole = 'employer' | 'employee' | 'both';

// Add this to extend Hono's ContextVariableMap
declare module "hono" {
    interface ContextVariableMap {
        user: DecodedToken;  // Change from 'customer' to 'user'
    }
}

/**
 * Verifies the validity of a JWT token
 */
export const verifyToken = async (token: string, secret: string): Promise<DecodedToken | null> => {
    try {
        const decoded = jwt.verify(token, secret) as DecodedToken;
        return decoded;
    } catch (error: any) {
        console.error('Token verification failed:', error.message);
        return null;
    }
}

/**
 * Main authentication and authorization middleware
 */
export const authMiddleware = async (c: Context, next: Next, requiredRole: UserRole) => {
    const authHeader = c.req.header("Authorization");

    if (!authHeader) {
        return c.json({ error: "Authorization header is required" }, 401);
    }

    if (!authHeader.startsWith("Bearer ")) {
        return c.json({ error: "Bearer token is required" }, 401);
    }

    const token = authHeader.substring(7);
    const decoded = await verifyToken(token, process.env.JWT_SECRET as string);

    if (!decoded) {
        return c.json({ error: "Invalid or expired token" }, 401);
    }

    // ✅ FIX: Set user in context using c.set()
    c.set('user', decoded);

    // Check role permissions
    if (requiredRole === "both") {
        if (decoded.userType === "employer" || decoded.userType === "employee") {
            return next();     
        }
    } else if (decoded.userType === requiredRole) {
        return next();     
    }

    return c.json({ error: "Insufficient permissions" }, 403);
}

export const employerRoleAuth = async (c: Context, next: Next) => await authMiddleware(c, next, "employer");
export const employeeRoleAuth = async (c: Context, next: Next) => await authMiddleware(c, next, "employee");
export const bothRolesAuth = async (c: Context, next: Next) => await authMiddleware(c, next, "both");