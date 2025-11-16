import sql from 'mssql';
import { getDbPool } from '../db/db.config.ts';

export interface Job {
  id: number;
  employer_id: number;
  title: string;
  description: string;
  requirements: string;
  location: string;
  salary: string;
  created_at: string;
  updated_at?: string;
  is_active: boolean;
  employer_name?: string;
}

export interface CreateJobData {
  title: string;
  description: string;
  requirements: string;
  location: string;
  salary: string;
}

export class JobService {
  // Create a new job
  static async createJob(employerId: number, jobData: CreateJobData): Promise<Job> {
    const pool = getDbPool();
    
    const result = await pool.request()
      .input('employer_id', sql.Int, employerId)
      .input('title', sql.NVarChar, jobData.title)
      .input('description', sql.NVarChar, jobData.description)
      .input('requirements', sql.NVarChar, jobData.requirements)
      .input('location', sql.NVarChar, jobData.location)
      .input('salary', sql.NVarChar, jobData.salary)
      .query(`
        INSERT INTO Jobs (employer_id, title, description, requirements, location, salary) 
        OUTPUT INSERTED.id, INSERTED.employer_id, INSERTED.title, INSERTED.description, 
               INSERTED.requirements, INSERTED.location, INSERTED.salary, INSERTED.created_at, INSERTED.is_active
        VALUES (@employer_id, @title, @description, @requirements, @location, @salary)
      `);
    
    return result.recordset[0] as Job;
  }

  // Get all active jobs
  static async getAllJobs(): Promise<Job[]> {
    const pool = getDbPool();
    
    const result = await pool.request()
      .query(`
        SELECT j.*, u.name as employer_name 
        FROM Jobs j 
        JOIN Users u ON j.employer_id = u.id 
        WHERE j.is_active = 1 
        ORDER BY j.created_at DESC
      `);
    
    return result.recordset as Job[];
  }

  // Get jobs by employer
  static async getJobsByEmployer(employerId: number): Promise<Job[]> {
    const pool = getDbPool();
    
    const result = await pool.request()
      .input('employer_id', sql.Int, employerId)
      .query(`
        SELECT * FROM Jobs 
        WHERE employer_id = @employer_id 
        ORDER BY created_at DESC
      `);
    
    return result.recordset as Job[];
  }

  // Get job by ID
  static async getJobById(jobId: number): Promise<Job | null> {
    const pool = getDbPool();
    
    const result = await pool.request()
      .input('job_id', sql.Int, jobId)
      .query(`
        SELECT j.*, u.name as employer_name 
        FROM Jobs j 
        JOIN Users u ON j.employer_id = u.id 
        WHERE j.id = @job_id AND j.is_active = 1
      `);
    
    return result.recordset.length > 0 ? (result.recordset[0] as Job) : null;
  }

  // Update job (dynamic fields)
  static async updateJob(jobId: number, employerId: number, jobData: Partial<CreateJobData>): Promise<boolean> {
    const pool = getDbPool();
    
    // Build dynamic update query
    const updates: string[] = [];
    const inputs: Record<string, string> = {};

    if (jobData.title) {
      updates.push('title = @title');
      inputs.title = jobData.title;
    }
    if (jobData.description) {
      updates.push('description = @description');
      inputs.description = jobData.description;
    }
    if (jobData.requirements) {
      updates.push('requirements = @requirements');
      inputs.requirements = jobData.requirements;
    }
    if (jobData.location) {
      updates.push('location = @location');
      inputs.location = jobData.location;
    }
    if (jobData.salary) {
      updates.push('salary = @salary');
      inputs.salary = jobData.salary;
    }

    if (updates.length === 0) {
      return false; // Nothing to update
    }

    let request = pool.request()
      .input('job_id', sql.Int, jobId)
      .input('employer_id', sql.Int, employerId);

    // Add dynamic inputs
    Object.keys(inputs).forEach(key => {
      request = request.input(key, sql.NVarChar, inputs[key]);
    });

    const result = await request.query(`
      UPDATE Jobs 
      SET ${updates.join(', ')}, updated_at = GETDATE()
      WHERE id = @job_id AND employer_id = @employer_id
    `);

    return result.rowsAffected[0] > 0;
  }

  // Delete job (soft delete)
  static async deleteJob(jobId: number, employerId: number): Promise<boolean> {
    const pool = getDbPool();
    
    const result = await pool.request()
      .input('job_id', sql.Int, jobId)
      .input('employer_id', sql.Int, employerId)
      .query(`
        UPDATE Jobs 
        SET is_active = 0, updated_at = GETDATE()
        WHERE id = @job_id AND employer_id = @employer_id
      `);
    
    return result.rowsAffected[0] > 0;
  }
}
