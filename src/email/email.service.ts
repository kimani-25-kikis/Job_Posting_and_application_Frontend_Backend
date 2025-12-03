import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { SendMailOptions } from 'nodemailer';

export interface EmailConfig {
  service: string;
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

export class EmailService {
  private transporter: Transporter;
  private fromEmail: string;

  constructor() {
    // Configuration for Gmail
    const config: EmailConfig = {
      service: 'gmail',
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.GMAIL_USER || '',
        pass: process.env.GMAIL_APP_PASSWORD || '' // Use App Password
      }
    };

    this.transporter = nodemailer.createTransport(config);
    this.fromEmail = process.env.EMAIL_FROM || `"Nexus Jobs" <${config.auth.user}>`;
    
    // Verify connection
    this.verifyConnection();
  }

  private async verifyConnection() {
    try {
      await this.transporter.verify();
      console.log('✅ Email server connection verified');
    } catch (error) {
      console.error('❌ Email server connection failed:', error);
    }
  }

  async sendWelcomeEmail(to: string, name: string, userType: string): Promise<void> {
    const subject = userType === 'employer' 
      ? 'Welcome to Nexus Jobs - Find the Best Talent!'
      : 'Welcome to Nexus Jobs - Find Your Dream Job!';

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px; background: #f9fafb; }
            .button { 
              display: inline-block; 
              padding: 12px 24px; 
              background: #2563eb; 
              color: white; 
              text-decoration: none; 
              border-radius: 5px; 
              margin: 15px 0;
            }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; }
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
              
              <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard" class="button">
                Go to Dashboard
              </a>
              
              <p>If you have any questions, feel free to contact our support team.</p>
              
              <p>Best regards,<br>The Nexus Jobs Team</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Nexus Jobs. All rights reserved.</p>
              <p>You're receiving this email because you registered on Nexus Jobs.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const mailOptions: SendMailOptions = {
      from: this.fromEmail,
      to,
      subject,
      html,
      text: `Welcome ${name}! Thank you for registering as an ${userType} on Nexus Jobs.` // Fallback text
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Welcome email sent to ${to}: ${info.messageId}`);
    } catch (error) {
      console.error(`❌ Failed to send email to ${to}:`, error);
      // Don't throw error - we don't want email failure to block registration
    }
  }

  // Optional: Add more email methods as needed
  async sendPasswordResetEmail(to: string, resetToken: string): Promise<void> {
    // Implement later if needed
  }
}

// Singleton instance
export const emailService = new EmailService();