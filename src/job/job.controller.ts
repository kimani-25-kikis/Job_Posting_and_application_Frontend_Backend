import { type Context } from 'hono';
import { JobService } from '../job/job.service.ts';
import { getDbPool } from '../db/db.config.ts';
import sql from 'mssql';

export class JobController {

  // Create a new job
  static async createJob(c: Context) {
    try {
      const { title, description, requirements, location, salary } = await c.req.json();
      const user = c.get('user');

      if (user.userType !== 'employer') {
        return c.json({ success: false, error: 'Only employers can create jobs' }, 403);
      }

      if (!title || !description || !requirements || !location || !salary) {
        return c.json({ success: false, error: 'All fields are required' }, 400);
      }

      const job = await JobService.createJob(user.userId, {
        title, description, requirements, location, salary
      });

      return c.json({
        success: true,
        message: 'Job created successfully',
        data: job
      }, 201);

    } catch (error: any) {
      console.error('Create job error:', error);
      return c.json({ success: false, error: 'Failed to create job' }, 500);
    }
  }

  // Get all jobs
  static async getAllJobs(c: Context) {
    try {
      const jobs = await JobService.getAllJobs();
      return c.json({ success: true, data: jobs });
    } catch (error: any) {
      console.error('Get jobs error:', error);
      return c.json({ success: false, error: 'Failed to fetch jobs' }, 500);
    }
  }

  // Get employer's jobs
  static async getEmployerJobs(c: Context) {
    try {
      const user = c.get('user');

      if (user.userType !== 'employer') {
        return c.json({ success: false, error: 'Access denied' }, 403);
      }

      const jobs = await JobService.getJobsByEmployer(user.userId);

      return c.json({ success: true, data: jobs });

    } catch (error: any) {
      console.error('Get employer jobs error:', error);
      return c.json({ success: false, error: 'Failed to fetch jobs' }, 500);
    }
  }

  // Get single job
  static async getJob(c: Context) {
    try {
      const jobId = parseInt(c.req.param('id'));

      if (isNaN(jobId)) {
        return c.json({ success: false, error: 'Invalid job ID' }, 400);
      }

      const job = await JobService.getJobById(jobId);

      if (!job) {
        return c.json({ success: false, error: 'Job not found' }, 404);
      }

      return c.json({ success: true, data: job });

    } catch (error: any) {
      console.error('Get job error:', error);
      return c.json({ success: false, error: 'Failed to fetch job' }, 500);
    }
  }

  // Update job
  static async updateJob(c: Context) {
    try {
      const jobId = parseInt(c.req.param('id'));
      const { title, description, requirements, location, salary } = await c.req.json();
      const user = c.get('user');

      if (user.userType !== 'employer') {
        return c.json({ success: false, error: 'Only employers can update jobs' }, 403);
      }

      if (isNaN(jobId)) {
        return c.json({ success: false, error: 'Invalid job ID' }, 400);
      }

      if (!title && !description && !requirements && !location && !salary) {
        return c.json({ success: false, error: 'At least one field must be provided for update' }, 400);
      }

      const updated = await JobService.updateJob(jobId, user.userId, {
        title, description, requirements, location, salary
      });

      if (!updated) {
        return c.json({ success: false, error: 'Job not found or access denied' }, 404);
      }

      const updatedJob = await JobService.getJobById(jobId);

      return c.json({
        success: true,
        message: 'Job updated successfully',
        data: updatedJob
      });

    } catch (error: any) {
      console.error('Update job error:', error);
      return c.json({ success: false, error: 'Failed to update job' }, 500);
    }
  }

  // Toggle job status
  static async toggleJobStatus(c: Context) {
    try {
      const jobId = parseInt(c.req.param('id'));
      const user = c.get('user');

      if (user.userType !== 'employer') {
        return c.json({ success: false, error: 'Only employers can update job status' }, 403);
      }

      if (isNaN(jobId)) {
        return c.json({ success: false, error: 'Invalid job ID' }, 400);
      }

      const toggledJob = await JobService.toggleJobStatus(jobId, user.userId);

      if (!toggledJob) {
        return c.json({ success: false, error: 'Job not found or access denied' }, 404);
      }

      return c.json({
        success: true,
        message: `Job ${toggledJob.is_active ? 'activated' : 'deactivated'} successfully`,
        data: toggledJob
      });

    } catch (error: any) {
      console.error('Toggle job status error:', error);
      return c.json({ success: false, error: 'Failed to update job status' }, 500);
    }
  }

  // Delete job (HARD DELETE)
  static async deleteJob(c: Context) {
    try {
      const jobId = parseInt(c.req.param('id'));
      const user = c.get('user');

      console.log('🗑️ Delete job attempt:', {
        jobId,
        employerId: user.userId,
        userType: user.userType
      });

      if (user.userType !== 'employer') {
        return c.json({ success: false, error: 'Only employers can delete jobs' }, 403);
      }

      if (isNaN(jobId)) {
        return c.json({ success: false, error: 'Invalid job ID' }, 400);
      }

      const job = await JobService.getJobById(jobId);
      console.log('🔍 Job found:', job);

      if (!job) {
        return c.json({ success: false, error: 'Job not found' }, 404);
      }

      if (job.employer_id !== user.userId) {
        console.log('🚫 Job ownership mismatch:', {
          jobEmployerId: job.employer_id,
          currentUserId: user.userId
        });
        return c.json({ success: false, error: 'Access denied - job does not belong to you' }, 403);
      }

      const hasApplications = await JobService.checkJobHasApplications(jobId);
      console.log('📋 Job has applications:', hasApplications);

      if (hasApplications) {
        const pool = getDbPool();
        const result = await pool.request()
          .input('job_id', sql.Int, jobId)
          .query('SELECT COUNT(*) as count FROM Applications WHERE job_id = @job_id');

        const appCount = result.recordset[0].count;

        return c.json({
          success: false,
          error: `Cannot delete job because it has ${appCount} application(s). Please delete applications first or deactivate the job instead.`
        }, 400);
      }

      const deleted = await JobService.hardDeleteJob(jobId, user.userId);
      console.log('✅ Delete result:', deleted);

      if (!deleted) {
        return c.json({ success: false, error: 'Job not found or access denied' }, 404);
      }

      return c.json({ success: true, message: 'Job deleted permanently' });

    } catch (error: any) {
      console.error('❌ Delete job error:', error);

      if (error.message?.includes('REFERENCE constraint') || error.message?.includes('foreign key constraint')) {
        return c.json({
          success: false,
          error: 'Cannot delete job because it has applications. Please delete applications first.'
        }, 400);
      }

      return c.json({ success: false, error: 'Failed to delete job' }, 500);
    }
  }
}
