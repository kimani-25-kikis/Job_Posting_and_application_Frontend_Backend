import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import sql from 'mssql';
import { getDbPool } from '../db/db.config.ts';
import nodemailer from 'nodemailer';

const JWT_SECRET = process.env.JWT_SECRET || 'nexus-jobs-secret-key';

// Email configuration
const emailConfig = {
  service: 'gmail',
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // true for port 465, false for other ports
  auth: {
    user: process.env.GMAIL_USER || '',
    pass: process.env.GMAIL_APP_PASSWORD || ''
  }
};

// Create transporter
const transporter = nodemailer.createTransport(emailConfig);

// Verify email connection on startup
transporter.verify()
  .then(() => console.log('✅ Email server connection verified'))
  .catch(err => console.error('❌ Email server connection failed:', err));

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

    // Send welcome email (async - don't block response)
    this.sendWelcomeEmail(email, name, user_type)
      .then(() => console.log(`✅ Welcome email sent to ${email}`))
      .catch(err => console.error(`❌ Failed to send email to ${email}:`, err));
    
    return { user, token };
  }

  // Send welcome email
  private static async sendWelcomeEmail(
    to: string, 
    name: string, 
    userType: 'employer' | 'employee'
  ): Promise<void> {
    const fromEmail = process.env.EMAIL_FROM || `"Nexus Jobs" <${emailConfig.auth.user}>`;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    
    const subject = userType === 'employer' 
      ? 'Welcome to Nexus Jobs - Find the Best Talent!'
      : 'Welcome to Nexus Jobs - Find Your Dream Job!';

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { padding: 30px; background: #f9fafb; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb; }
            .button { 
              display: inline-block; 
              padding: 12px 24px; 
              background: #2563eb; 
              color: white; 
              text-decoration: none; 
              border-radius: 5px; 
              margin: 15px 0;
              font-weight: bold;
            }
            .footer { 
              padding: 20px; 
              text-align: center; 
              background: #f1f5f9; 
              border-radius: 0 0 8px 8px;
              border: 1px solid #e5e7eb;
              border-top: none;
              color: #64748b;
              font-size: 14px;
            }
            ul { padding-left: 20px; }
            li { margin-bottom: 8px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to Nexus Jobs!</h1>
            </div>
            <div class="content">
              <h2>Hello ${name}!</h2>
              <p>Thank you for registering as an <strong>${userType}</strong> on Nexus Jobs.</p>
              
              ${userType === 'employer' 
                ? '<p>Start posting jobs and finding the perfect candidates for your team!</p>'
                : '<p>Start browsing job opportunities and take the next step in your career!</p>'
              }
              
              <p>Your account has been successfully created. You can now:</p>
              <ul>
                ${userType === 'employer'
                  ? '<li>Post job listings</li><li>Review applications</li><li>Connect with top talent</li>'
                  : '<li>Browse job listings</li><li>Apply to jobs</li><li>Build your profile</li>'
                }
              </ul>
              
              <div style="text-align: center; margin: 25px 0;">
                <a href="${frontendUrl}/dashboard" class="button">
                  Go to Dashboard
                </a>
              </div>
              
              <p>If you have any questions, feel free to contact our support team.</p>
              
              <p>Best regards,<br>The Nexus Jobs Team</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Nexus Jobs. All rights reserved.</p>
              <p>This email was sent to ${to} because you registered on Nexus Jobs.</p>
              <p>If you didn't create this account, please ignore this email.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `Welcome ${name}!\n\nThank you for registering as an ${userType} on Nexus Jobs.\n\nYour account has been successfully created. You can now access your dashboard at: ${frontendUrl}/dashboard\n\nBest regards,\nThe Nexus Jobs Team`;

    const mailOptions = {
      from: fromEmail,
      to,
      subject,
      html,
      text
    };

    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(`📧 Email sent to ${to}: ${info.messageId}`);
    } catch (error) {
      console.error(`❌ Email error for ${to}:`, error);
      throw error; // Throw to be caught in register method
    }
  }

  // Add this to your AuthService class in auth.service.ts
static async sendStatusUpdateEmail(
  applicationId: number,
  newStatus: 'shortlisted' | 'accepted' | 'rejected',
  jobTitle: string,
  employerName: string,
  employeeEmail: string,
  employeeName: string
): Promise<void> {
  
  const fromEmail = process.env.EMAIL_FROM || `"Nexus Jobs" <${emailConfig.auth.user}>`;
  
  // Email content based on status
  const statusConfig = {
    shortlisted: {
      subject: `🎉 Congratulations! You've been shortlisted for "${jobTitle}"`,
      icon: '⭐',
      title: 'Shortlisted!',
      message: 'You have been shortlisted for the next stage of the hiring process. The employer will contact you shortly for the next steps.',
      action: 'Prepare for the interview process'
    },
    accepted: {
      subject: `🎊 Congratulations! You've been accepted for "${jobTitle}"`,
      icon: '✅',
      title: 'Job Offer Accepted!',
      message: 'Congratulations! Your application has been accepted. Expect contact from HR for onboarding and next steps.',
      action: 'Review the offer details'
    },
    rejected: {
      subject: `Update on your application for "${jobTitle}"`,
      icon: '📝',
      title: 'Application Status Update',
      message: 'Thank you for your application. After careful consideration, we have decided to move forward with other candidates.',
      action: 'Continue exploring opportunities on Nexus Jobs'
    }
  };

  const config = statusConfig[newStatus];

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { 
            background: ${newStatus === 'accepted' ? '#10b981' : newStatus === 'shortlisted' ? '#f59e0b' : '#ef4444'}; 
            color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; 
          }
          .content { padding: 30px; background: #f9fafb; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb; }
          .status-card { 
            background: white; padding: 20px; border-radius: 10px; margin: 20px 0; 
            border-left: 4px solid ${newStatus === 'accepted' ? '#10b981' : newStatus === 'shortlisted' ? '#f59e0b' : '#ef4444'};
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .footer { 
            padding: 20px; text-align: center; background: #f1f5f9; 
            border-radius: 0 0 10px 10px; color: #64748b; font-size: 14px;
            border-top: 1px solid #e2e8f0;
          }
          .button {
            display: inline-block;
            padding: 12px 24px;
            background: ${newStatus === 'accepted' ? '#10b981' : newStatus === 'shortlisted' ? '#f59e0b' : '#3b82f6'};
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin: 15px 0;
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${config.icon} ${config.title}</h1>
            <p>Application ID: #${applicationId}</p>
          </div>
          
          <div class="content">
            <h2>Hello ${employeeName},</h2>
            
            <div class="status-card">
              <h3>${jobTitle}</h3>
              <p><strong>Company:</strong> ${employerName}</p>
              <p><strong>Status:</strong> 
                <span style="color: ${newStatus === 'accepted' ? '#10b981' : newStatus === 'shortlisted' ? '#f59e0b' : '#ef4444'}; 
                      font-weight: bold; font-size: 1.1em;">
                  ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}
                </span>
              </p>
              <p>${config.message}</p>
            </div>
            
            <p><strong>Next Steps:</strong></p>
            <ul>
              <li>${config.action}</li>
              ${newStatus === 'accepted' ? '<li>Expect contact from HR for onboarding</li>' : ''}
              ${newStatus === 'shortlisted' ? '<li>Prepare for the interview process</li>' : ''}
              <li>Check your Nexus Jobs dashboard for updates</li>
            </ul>
            
            <div style="text-align: center; margin: 25px 0;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard" class="button">
                View Your Dashboard
              </a>
            </div>
            
            <p>Best regards,<br>The ${employerName} Team</p>
          </div>
          
          <div class="footer">
            <p>This email was sent regarding your application on Nexus Jobs.</p>
            <p>Application ID: #${applicationId} • ${new Date().toLocaleDateString()}</p>
            <p>© ${new Date().getFullYear()} Nexus Jobs. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `Hello ${employeeName},

Your application for "${jobTitle}" at ${employerName} has been updated.

New Status: ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}

${config.message}

Next Steps:
- ${config.action}
${newStatus === 'accepted' ? '- Expect contact from HR for onboarding' : ''}
${newStatus === 'shortlisted' ? '- Prepare for the interview process' : ''}
- Check your Nexus Jobs dashboard for updates

Best regards,
The ${employerName} Team

---
Application ID: #${applicationId}
Nexus Jobs
`;

  const mailOptions = {
    from: fromEmail,
    to: employeeEmail,
    subject: config.subject,
    html,
    text
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 Status update email sent to ${employeeEmail}: ${info.messageId}`);
  } catch (error) {
    console.error(`❌ Failed to send status email to ${employeeEmail}:`, error);
    // Don't throw - we don't want email failure to block status update
    throw error; // Actually throw it so we can see the error
  }
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

  // Optional: Forgot password email method
  static async sendPasswordResetEmail(email: string): Promise<void> {
    const pool = getDbPool();
    
    const result = await pool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT id, name FROM Users WHERE email = @email');
    
    if (result.recordset.length === 0) {
      // Don't reveal if user exists or not
      return;
    }
    
    const user = result.recordset[0];
    const resetToken = jwt.sign(
      { userId: user.id, email },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
    const fromEmail = process.env.EMAIL_FROM || `"Nexus Jobs" <${emailConfig.auth.user}>`;
    
    const mailOptions = {
      from: fromEmail,
      to: email,
      subject: 'Reset Your Nexus Jobs Password',
      html: `
        <h1>Password Reset Request</h1>
        <p>Hello ${user.name},</p>
        <p>We received a request to reset your password. Click the link below to reset it:</p>
        <a href="${resetLink}">Reset Password</a>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `
    };
    
    try {
      await transporter.sendMail(mailOptions);
      console.log(`📧 Password reset email sent to ${email}`);
    } catch (error) {
      console.error(`❌ Failed to send reset email to ${email}:`, error);
    }
  }
}

