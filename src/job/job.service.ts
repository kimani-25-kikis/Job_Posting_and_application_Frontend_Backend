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
        OUTPUT INSERTED.*
        VALUES (@employer_id, @title, @description, @requirements, @location, @salary)
      `);

    return result.recordset[0] as Job;
  }

  // Get all active jobs (public list)
  static async getAllJobs(): Promise<Job[]> {
    const pool = getDbPool();

    const result = await pool.request().query(`
      SELECT j.*, u.name AS employer_name
      FROM Jobs j
      JOIN Users u ON u.id = j.employer_id
      WHERE j.is_active = 1
      ORDER BY j.created_at DESC
    `);

    return result.recordset as Job[];
  }

  // Get all jobs belonging to a specific employer
  static async getJobsByEmployer(employerId: number): Promise<Job[]> {
    const pool = getDbPool();

    const result = await pool.request()
      .input("employer_id", sql.Int, employerId)
      .query(`
        SELECT j.*, u.name AS employer_name
        FROM Jobs j
        JOIN Users u ON j.employer_id = u.id
        WHERE j.employer_id = @employer_id
        ORDER BY j.created_at DESC
      `);

    return result.recordset as Job[];
  }

  /**
   * Get job by ID
   * - If employerId is provided → return job even if inactive (employer view)
   * - If no employerId → return only active jobs (public view)
   */
  static async getJobById(jobId: number, employerId?: number): Promise<Job | null> {
    const pool = getDbPool();

    let query = `
      SELECT j.*, u.name AS employer_name
      FROM Jobs j
      JOIN Users u ON j.employer_id = u.id
      WHERE j.id = @job_id
    `;

    const request = pool.request().input("job_id", sql.Int, jobId);

    if (employerId) {
      query += ` AND j.employer_id = @employer_id`;
      request.input("employer_id", sql.Int, employerId);
    } else {
      query += ` AND j.is_active = 1`; // Only visible to employees / job seekers
    }

    const result = await request.query(query);

    return result.recordset.length > 0 ? (result.recordset[0] as Job) : null;
  }

  // Update a job (only dynamic fields update)
  static async updateJob(
    jobId: number,
    employerId: number,
    jobData: Partial<CreateJobData>
  ): Promise<boolean> {
    const pool = getDbPool();

    const updates: string[] = [];
    const request = pool.request();

    request.input("job_id", sql.Int, jobId);
    request.input("employer_id", sql.Int, employerId);

    for (const key of Object.keys(jobData)) {
      const value = (jobData as any)[key];
      if (value) {
        updates.push(`${key} = @${key}`);
        request.input(key, sql.NVarChar, value);
      }
    }

    if (updates.length === 0) return false;

    const result = await request.query(`
      UPDATE Jobs
      SET ${updates.join(", ")}, updated_at = GETDATE()
      WHERE id = @job_id AND employer_id = @employer_id
    `);

    return result.rowsAffected[0] > 0;
  }

  // Soft delete job (makes job inactive)
  static async deleteJob(jobId: number, employerId: number): Promise<boolean> {
    const pool = getDbPool();

    const result = await pool.request()
      .input("job_id", sql.Int, jobId)
      .input("employer_id", sql.Int, employerId)
      .query(`
        UPDATE Jobs
        SET is_active = 0, updated_at = GETDATE()
        WHERE id = @job_id AND employer_id = @employer_id
      `);

    return result.rowsAffected[0] > 0;
  }

  // Toggle job active/inactive
  static async toggleJobStatus(jobId: number, employerId: number): Promise<Job | null> {
    const pool = getDbPool();

    const jobResult = await pool.request()
      .input("job_id", sql.Int, jobId)
      .input("employer_id", sql.Int, employerId)
      .query(`
        SELECT * FROM Jobs
        WHERE id = @job_id AND employer_id = @employer_id
      `);

    if (jobResult.recordset.length === 0) return null;

    const job = jobResult.recordset[0];
    const newStatus = !job.is_active;

    await pool.request()
      .input("job_id", sql.Int, jobId)
      .input("employer_id", sql.Int, employerId)
      .input("is_active", sql.Bit, newStatus)
      .query(`
        UPDATE Jobs
        SET is_active = @is_active, updated_at = GETDATE()
        WHERE id = @job_id AND employer_id = @employer_id
      `);

    const updatedJob = await pool.request()
      .input("job_id", sql.Int, jobId)
      .query(`SELECT * FROM Jobs WHERE id = @job_id`);

    return updatedJob.recordset[0] as Job;
  }

  // Check if job has applications
  static async checkJobHasApplications(jobId: number): Promise<boolean> {
    const pool = getDbPool();

    const result = await pool.request()
      .input("job_id", sql.Int, jobId)
      .query(`
        SELECT COUNT(*) AS application_count
        FROM Applications
        WHERE job_id = @job_id
      `);

    return result.recordset[0].application_count > 0;
  }

  // Hard delete job (permanently)
  static async hardDeleteJob(jobId: number, employerId: number): Promise<boolean> {
    const pool = getDbPool();

    const result = await pool.request()
      .input("job_id", sql.Int, jobId)
      .input("employer_id", sql.Int, employerId)
      .query(`
        DELETE FROM Jobs
        WHERE id = @job_id AND employer_id = @employer_id
      `);

    return result.rowsAffected[0] > 0;
  }
}
