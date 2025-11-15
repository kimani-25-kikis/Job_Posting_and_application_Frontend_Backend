import sql from 'mssql';
import { getDbPool } from '../db/db.config.ts';

export interface Application {
  id: number;
  job_id: number;
  employee_id: number;
  status: 'applied' | 'viewed' | 'shortlisted' | 'rejected' | 'accepted';
  applied_at: string;
  updated_at: string;
  job_title?: string;
  employer_name?: string;
  employee_name?: string;
}

export interface ApplicationStats {
  total: number;
  applied: number;
  viewed: number;
  shortlisted: number;
  rejected: number;
  accepted: number;
}

export class ApplicationService {
  // Apply for a job
  static async applyForJob(jobId: number, employeeId: number): Promise<Application> {
    const pool = getDbPool();
    
    // Check if already applied
    const existing = await pool.request()
      .input('job_id', sql.Int, jobId)
      .input('employee_id', sql.Int, employeeId)
      .query('SELECT id FROM Applications WHERE job_id = @job_id AND employee_id = @employee_id');
    
    if (existing.recordset.length > 0) {
      throw new Error('You have already applied for this job');
    }
    
    const result = await pool.request()
      .input('job_id', sql.Int, jobId)
      .input('employee_id', sql.Int, employeeId)
      .query(`
        INSERT INTO Applications (job_id, employee_id) 
        OUTPUT INSERTED.*
        VALUES (@job_id, @employee_id)
      `);
    
    return result.recordset[0] as Application;
  }

  // Get applications by employee
  static async getApplicationsByEmployee(employeeId: number): Promise<Application[]> {
    const pool = getDbPool();
    
    const result = await pool.request()
      .input('employee_id', sql.Int, employeeId)
      .query(`
        SELECT a.*, j.title as job_title, u.name as employer_name
        FROM Applications a
        JOIN Jobs j ON a.job_id = j.id
        JOIN Users u ON j.employer_id = u.id
        WHERE a.employee_id = @employee_id
        ORDER BY a.applied_at DESC
      `);
    
    return result.recordset as Application[];
  }

  // Get applications for employer's jobs
  static async getApplicationsForEmployer(employerId: number): Promise<Application[]> {
    const pool = getDbPool();
    
    const result = await pool.request()
      .input('employer_id', sql.Int, employerId)
      .query(`
        SELECT a.*, j.title as job_title, u.name as employee_name
        FROM Applications a
        JOIN Jobs j ON a.job_id = j.id
        JOIN Users u ON a.employee_id = u.id
        WHERE j.employer_id = @employer_id
        ORDER BY a.applied_at DESC
      `);
    
    return result.recordset as Application[];
  }

  // Update application status
  static async updateApplicationStatus(
    applicationId: number, 
    status: Application['status'],
    updaterId: number,
    updaterType: 'employer' | 'employee'
  ): Promise<boolean> {
    const pool = getDbPool();
    
    let query = '';
    if (updaterType === 'employer') {
      query = `
        UPDATE Applications 
        SET status = @status, updated_at = GETDATE()
        FROM Applications a
        JOIN Jobs j ON a.job_id = j.id
        WHERE a.id = @application_id AND j.employer_id = @updater_id
      `;
    } else {
      query = `
        UPDATE Applications 
        SET status = @status, updated_at = GETDATE()
        WHERE id = @application_id AND employee_id = @updater_id
      `;
    }
    
    const result = await pool.request()
      .input('application_id', sql.Int, applicationId)
      .input('status', sql.NVarChar, status)
      .input('updater_id', sql.Int, updaterId)
      .query(query);
    
    return result.rowsAffected[0] > 0;
  }

  // Get application statistics for employee
  static async getApplicationStats(employeeId: number): Promise<ApplicationStats> {
    const pool = getDbPool();
    
    const result = await pool.request()
      .input('employee_id', sql.Int, employeeId)
      .query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'applied' THEN 1 ELSE 0 END) as applied,
          SUM(CASE WHEN status = 'viewed' THEN 1 ELSE 0 END) as viewed,
          SUM(CASE WHEN status = 'shortlisted' THEN 1 ELSE 0 END) as shortlisted,
          SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
          SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted
        FROM Applications 
        WHERE employee_id = @employee_id
      `);
    
    return result.recordset[0] as ApplicationStats;
  }
}