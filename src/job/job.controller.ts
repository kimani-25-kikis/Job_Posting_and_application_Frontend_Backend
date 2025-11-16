import { type Context } from 'hono';
import { JobService } from '../job/job.service.ts';

export class JobController {
  // Create a new job
  static async createJob(c: Context) {
    try {
      const { title, description, requirements, location, salary } = await c.req.json();
      const user = c.get('user'); // From auth middleware

      if (user.userType !== 'employer') {
        return c.json({ 
          success: false,
          error: 'Only employers can create jobs' 
        }, 403);
      }

      // Validation
      if (!title || !description || !requirements || !location || !salary) {
        return c.json({ 
          success: false,
          error: 'All fields are required' 
        }, 400);
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
      return c.json({ 
        success: false,
        error: 'Failed to create job' 
      }, 500);
    }
  }

  // Get all jobs
  static async getAllJobs(c: Context) {
    try {
      const jobs = await JobService.getAllJobs();

      return c.json({
        success: true,
        data: jobs
      });

    } catch (error: any) {
      console.error('Get jobs error:', error);
      return c.json({ 
        success: false,
        error: 'Failed to fetch jobs' 
      }, 500);
    }
  }

  // Get employer's jobs
  static async getEmployerJobs(c: Context) {
    try {
      const user = c.get('user');
      
      if (user.userType !== 'employer') {
        return c.json({ 
          success: false,
          error: 'Access denied' 
        }, 403);
      }

      const jobs = await JobService.getJobsByEmployer(user.userId);

      return c.json({
        success: true,
        data: jobs
      });

    } catch (error: any) {
      console.error('Get employer jobs error:', error);
      return c.json({ 
        success: false,
        error: 'Failed to fetch jobs' 
      }, 500);
    }
  }

  // Get single job
  static async getJob(c: Context) {
    try {
      const jobId = parseInt(c.req.param('id'));
      
      if (isNaN(jobId)) {
        return c.json({ 
          success: false,
          error: 'Invalid job ID' 
        }, 400);
      }

      const job = await JobService.getJobById(jobId);

      if (!job) {
        return c.json({ 
          success: false,
          error: 'Job not found' 
        }, 404);
      }

      return c.json({
        success: true,
        data: job
      });

    } catch (error: any) {
      console.error('Get job error:', error);
      return c.json({ 
        success: false,
        error: 'Failed to fetch job' 
      }, 500);
    }
  }

  // Update job
static async updateJob(c: Context) {
  try {
    const jobId = parseInt(c.req.param('id'));
    const { title, description, requirements, location, salary } = await c.req.json();
    const user = c.get('user');

    if (user.userType !== 'employer') {
      return c.json({ 
        success: false,
        error: 'Only employers can update jobs' 
      }, 403);
    }

    if (isNaN(jobId)) {
      return c.json({ 
        success: false,
        error: 'Invalid job ID' 
      }, 400);
    }

    // Validate at least one field is provided
    if (!title && !description && !requirements && !location && !salary) {
      return c.json({ 
        success: false,
        error: 'At least one field must be provided for update' 
      }, 400);
    }

    const updated = await JobService.updateJob(jobId, user.userId, {
      title, description, requirements, location, salary
    });

    if (!updated) {
      return c.json({ 
        success: false,
        error: 'Job not found or access denied' 
      }, 404);
    }

    // Get the updated job to return
    const updatedJob = await JobService.getJobById(jobId);

    return c.json({
      success: true,
      message: 'Job updated successfully',
      data: updatedJob
    });

  } catch (error: any) {
    console.error('Update job error:', error);
    return c.json({ 
      success: false,
      error: 'Failed to update job' 
    }, 500);
  }
}

// Delete job (soft delete)
static async deleteJob(c: Context) {
  try {
    const jobId = parseInt(c.req.param('id'));
    const user = c.get('user');

    if (user.userType !== 'employer') {
      return c.json({ 
        success: false,
        error: 'Only employers can delete jobs' 
      }, 403);
    }

    if (isNaN(jobId)) {
      return c.json({ 
        success: false,
        error: 'Invalid job ID' 
      }, 400);
    }

    const deleted = await JobService.deleteJob(jobId, user.userId);

    if (!deleted) {
      return c.json({ 
        success: false,
        error: 'Job not found or access denied' 
      }, 404);
    }

    return c.json({
      success: true,
      message: 'Job deleted successfully'
    });

  } catch (error: any) {
    console.error('Delete job error:', error);
    return c.json({ 
      success: false,
      error: 'Failed to delete job' 
    }, 500);
  }
}
}