import { type Context } from 'hono';
import { ApplicationService } from './application.service.ts';

export class ApplicationController {

  // Apply for a job (with optional resume)
  static async applyForJob(c: Context) {
    try {
      const { jobId, resumeData } = await c.req.json();
      const user = c.get('user');

      if (user.userType !== 'employee') {
        return c.json({ 
          success: false,
          error: 'Only employees can apply for jobs' 
        }, 403);
      }

      if (!jobId) {
        return c.json({ 
          success: false,
          error: 'Job ID is required' 
        }, 400);
      }

      const application = await ApplicationService.applyForJob(
        jobId, 
        user.userId, 
        resumeData // may be undefined
      );

      return c.json({
        success: true,
        message: 'Application submitted successfully',
        data: application
      }, 201);

    } catch (error: any) {
      console.error('Apply for job error:', error);

      if (error.message.includes('already applied')) {
        return c.json({ 
          success: false,
          error: error.message 
        }, 409);
      }

      return c.json({ 
        success: false,
        error: 'Failed to apply for job' 
      }, 500);
    }
  }

  // Get employee applications + stats
  static async getEmployeeApplications(c: Context) {
    try {
      const user = c.get('user');

      if (user.userType !== 'employee') {
        return c.json({ 
          success: false,
          error: 'Access denied' 
        }, 403);
      }

      const applications = await ApplicationService.getApplicationsByEmployee(user.userId);
      const stats = await ApplicationService.getApplicationStats(user.userId);

      return c.json({
        success: true,
        data: { applications, stats }
      });

    } catch (error: any) {
      console.error('Get applications error:', error);
      return c.json({ 
        success: false,
        error: 'Failed to fetch applications' 
      }, 500);
    }
  }

  // Get employer applications
  static async getEmployerApplications(c: Context) {
    try {
      const user = c.get('user');

      if (user.userType !== 'employer') {
        return c.json({ 
          success: false,
          error: 'Access denied' 
        }, 403);
      }

      const applications = await ApplicationService.getEmployerApplications(user.userId);

      return c.json({
        success: true,
        data: applications
      });

    } catch (error: any) {
      console.error('Get employer applications error:', error);
      return c.json({ 
        success: false,
        error: 'Failed to fetch applications' 
      }, 500);
    }
  }

  // Update application status
  static async updateApplicationStatus(c: Context) {
    try {
      const applicationId = parseInt(c.req.param('id'));
      const { status } = await c.req.json();
      const user = c.get('user');

      if (isNaN(applicationId)) {
        return c.json({ 
          success: false,
          error: 'Invalid application ID' 
        }, 400);
      }

      const validStatuses = ['applied', 'viewed', 'shortlisted', 'rejected', 'accepted'];
      if (!status || !validStatuses.includes(status)) {
        return c.json({ 
          success: false,
          error: 'Valid status is required' 
        }, 400);
      }

      const updated = await ApplicationService.updateApplicationStatus(
        applicationId, 
        status, 
        user.userId, 
        user.userType
      );

      if (!updated) {
        return c.json({ 
          success: false,
          error: 'Application not found or access denied' 
        }, 404);
      }

      return c.json({
        success: true,
        message: 'Application status updated successfully'
      });

    } catch (error: any) {
      console.error('Update application status error:', error);
      return c.json({ 
        success: false,
        error: 'Failed to update application status' 
      }, 500);
    }
  }
}
