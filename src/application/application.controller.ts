import { type Context } from 'hono';
import { ApplicationService } from './application.service.ts';

export class ApplicationController {

  // Apply for a job (with optional resume)
  static async applyForJob(c: Context) {
    try {
      const { jobId, resumeData } = await c.req.json();
      const user = c.get('user');

      console.log('🎯 [ApplicationController] Apply for job request:', {
        jobId,
        employeeId: user.userId,
        userType: user.userType
      });

      if (user.userType !== 'employee') {
        console.warn('🚫 [ApplicationController] Non-employee attempted to apply for job:', user.userType);
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
        resumeData
      );

      console.log('✅ [ApplicationController] Application submitted successfully:', {
        applicationId: application.id,
        jobId,
        employeeId: user.userId
      });

      return c.json({
        success: true,
        message: 'Application submitted successfully',
        data: application
      }, 201);

    } catch (error: any) {
      console.error('❌ [ApplicationController] Apply for job error:', error);

      if (error.message.includes('already applied')) {
        return c.json({ 
          success: false,
          error: error.message 
        }, 409);
      }

      if (error.message.includes('Job not found')) {
        return c.json({ 
          success: false,
          error: error.message 
        }, 404);
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

      console.log('👤 [ApplicationController] Get employee applications request:', {
        employeeId: user.userId,
        userType: user.userType
      });

      if (user.userType !== 'employee') {
        console.warn('🚫 [ApplicationController] Non-employee attempted to access employee applications:', user.userType);
        return c.json({ 
          success: false,
          error: 'Access denied' 
        }, 403);
      }

      const applications = await ApplicationService.getApplicationsByEmployee(user.userId);
      const stats = await ApplicationService.getApplicationStats(user.userId);

      console.log('✅ [ApplicationController] Employee applications retrieved:', {
        employeeId: user.userId,
        applicationsCount: applications.length,
        stats
      });

      return c.json({
        success: true,
        data: { applications, stats }
      });

    } catch (error: any) {
      console.error('❌ [ApplicationController] Get employee applications error:', error);
      return c.json({ 
        success: false,
        error: 'Failed to fetch applications' 
      }, 500);
    }
  }

  // Get employer applications - SECURITY CRITICAL
  static async getEmployerApplications(c: Context) {
    try {
      const user = c.get('user');

      console.log('🏢 [ApplicationController] Get employer applications request:', {
        employerId: user.userId,
        userType: user.userType,
        email: user.email
      });

      if (user.userType !== 'employer') {
        console.warn('🚫 [ApplicationController] Non-employer attempted to access employer applications:', user.userType);
        return c.json({ 
          success: false,
          error: 'Access denied' 
        }, 403);
      }

      const applications = await ApplicationService.getEmployerApplications(user.userId);

      console.log('✅ [ApplicationController] Employer applications retrieved:', {
        employerId: user.userId,
        applicationsCount: applications.length,
        applicationIds: applications.map((app: any) => app.id),
        // Log first application details for verification
        sampleApplication: applications.length > 0 ? {
          id: applications[0].id,
          jobId: applications[0].job_id,
          jobTitle: applications[0].job_title,
          employeeName: applications[0].employee_name,
          employerIdInRecord: applications[0].employer_id
        } : 'No applications'
      });

      // Additional security verification
      const unauthorizedApplications = applications.filter((app: any) => 
        app.employer_id !== user.userId
      );

      if (unauthorizedApplications.length > 0) {
        console.error('🚨 SECURITY ALERT: Unauthorized applications found for employer:', {
          employerId: user.userId,
          unauthorizedCount: unauthorizedApplications.length,
          unauthorizedApplicationIds: unauthorizedApplications.map((app: any) => app.id)
        });
        
        // Filter out any unauthorized applications as a safety measure
        const authorizedApplications = applications.filter((app: any) => 
          app.employer_id === user.userId
        );
        
        return c.json({
          success: true,
          data: authorizedApplications,
          warning: 'Some applications were filtered due to security checks'
        });
      }

      return c.json({
        success: true,
        data: applications
      });

    } catch (error: any) {
      console.error('❌ [ApplicationController] Get employer applications error:', error);
      return c.json({ 
        success: false,
        error: 'Failed to fetch applications' 
      }, 500);
    }
  }

  // Update application status with enhanced security
  static async updateApplicationStatus(c: Context) {
    try {
      const applicationId = parseInt(c.req.param('id'));
      const { status } = await c.req.json();
      const user = c.get('user');

      console.log('🔄 [ApplicationController] Update application status request:', {
        applicationId,
        status,
        userId: user.userId,
        userType: user.userType
      });

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

      // Additional security: Verify application exists and belongs to employer
      if (user.userType === 'employer') {
        const application = await ApplicationService.getApplicationById(applicationId);
        
        if (!application) {
          console.warn('🚫 [ApplicationController] Employer attempted to update non-existent application:', {
            employerId: user.userId,
            applicationId
          });
          return c.json({ 
            success: false,
            error: 'Application not found' 
          }, 404);
        }

        if (application.employer_id !== user.userId) {
          console.error('🚨 SECURITY ALERT: Employer attempted to update another employer\'s application:', {
            employerId: user.userId,
            applicationEmployerId: application.employer_id,
            applicationId
          });
          return c.json({ 
            success: false,
            error: 'Access denied' 
          }, 403);
        }
      }

      const updated = await ApplicationService.updateApplicationStatus(
        applicationId, 
        status, 
        user.userId, 
        user.userType
      );

      if (!updated) {
        console.warn('⚠️ [ApplicationController] Application update failed - not found or access denied:', {
          applicationId,
          userId: user.userId,
          userType: user.userType
        });
        return c.json({ 
          success: false,
          error: 'Application not found or access denied' 
        }, 404);
      }

      console.log('✅ [ApplicationController] Application status updated successfully:', {
        applicationId,
        newStatus: status,
        updatedBy: user.userType,
        userId: user.userId
      });

      return c.json({
        success: true,
        message: 'Application status updated successfully'
      });

    } catch (error: any) {
      console.error('❌ [ApplicationController] Update application status error:', error);
      return c.json({ 
        success: false,
        error: 'Failed to update application status' 
      }, 500);
    }
  }

  // NEW: Debug endpoint to verify security (remove in production)
  static async debugEmployerApplications(c: Context) {
    try {
      const user = c.get('user');
      const employerIdParam = c.req.query('employerId');
      const testEmployerId = employerIdParam ? parseInt(employerIdParam) : user.userId;

      console.log('🐛 [DebugController] Debug employer applications:', {
        authenticatedEmployerId: user.userId,
        testEmployerId,
        userType: user.userType
      });

      if (user.userType !== 'employer') {
        return c.json({ 
          success: false,
          error: 'Access denied' 
        }, 403);
      }

      const applications = await ApplicationService.getEmployerApplications(testEmployerId);

      return c.json({
        success: true,
        debugInfo: {
          authenticatedEmployerId: user.userId,
          testEmployerId,
          applicationsCount: applications.length,
          applications: applications.map((app: any) => ({
            id: app.id,
            job_id: app.job_id,
            job_title: app.job_title,
            employee_name: app.employee_name,
            employer_id: app.employer_id,
            status: app.status
          }))
        }
      });

    } catch (error: any) {
      console.error('Debug error:', error);
      return c.json({ 
        success: false,
        error: 'Debug failed' 
      }, 500);
    }
  }
}