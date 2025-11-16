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
  resume_filename?: string;
  resume_url?: string;
  file_size?: number;
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

  // Apply for a job with optional resume upload
  static async applyForJob(
    jobId: number,
    employeeId: number,
    resumeData?: { filename: string; originalName: string; size: number }
  ): Promise<Application> {
    const pool = getDbPool();

    console.log('🔍 [ApplicationService] Checking for existing application:', {
      jobId,
      employeeId,
      timestamp: new Date().toISOString()
    });

    // Check if already applied - THIS LOOKS CORRECT
    const existing = await pool.request()
      .input('job_id', sql.Int, jobId)
      .input('employee_id', sql.Int, employeeId)
      .query('SELECT id FROM Applications WHERE job_id = @job_id AND employee_id = @employee_id');

    console.log('📋 [ApplicationService] Existing applications found:', existing.recordset.length);
    
    if (existing.recordset.length > 0) {
      console.log('🚫 [ApplicationService] Blocking duplicate application for employee:', employeeId);
      throw new Error('You have already applied for this job');
    }

    // Also check if job exists and is active
    const jobCheck = await pool.request()
      .input('job_id', sql.Int, jobId)
      .query('SELECT id, title, is_active FROM Jobs WHERE id = @job_id AND is_active = 1');

    if (jobCheck.recordset.length === 0) {
      throw new Error('Job not found or no longer active');
    }

    console.log('✅ [ApplicationService] Creating new application for employee:', employeeId);

    let query = '';
    let request = pool.request()
      .input('job_id', sql.Int, jobId)
      .input('employee_id', sql.Int, employeeId);

    // If resume uploaded
    if (resumeData) {
      query = `
        INSERT INTO Applications (job_id, employee_id, resume_filename, resume_url, file_size) 
        OUTPUT INSERTED.*
        VALUES (@job_id, @employee_id, @resume_filename, @resume_url, @file_size)
      `;

      request = request
        .input('resume_filename', sql.NVarChar, resumeData.filename)
        .input('resume_url', sql.NVarChar, `/uploads/resumes/${resumeData.filename}`)
        .input('file_size', sql.Int, resumeData.size);
    } 
    // If no resume
    else {
      query = `
        INSERT INTO Applications (job_id, employee_id) 
        OUTPUT INSERTED.*
        VALUES (@job_id, @employee_id)
      `;
    }

    const result = await request.query(query);
    console.log('🎉 [ApplicationService] Application created successfully:', result.recordset[0].id);
    
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
  static async getEmployerApplications(employerId: number): Promise<any[]> {
    const pool = getDbPool();
    
    const result = await pool.request()
      .input('employer_id', sql.Int, employerId)
      .query(`
        SELECT 
          a.*,
          j.title as job_title,
          j.employer_id,
          e.name as employee_name,
          emp.name as employer_name
        FROM Applications a
        JOIN Jobs j ON a.job_id = j.id
        JOIN Users e ON a.employee_id = e.id
        JOIN Users emp ON j.employer_id = emp.id
        WHERE j.employer_id = @employer_id
        ORDER BY a.applied_at DESC
      `);

    return result.recordset;
  }

  // Update application status
  static async updateApplicationStatus(
    applicationId: number,
    status: Application['status'],
    updaterId: number,
    updaterType: 'employer' | 'employee'
  ): Promise<boolean> {
    const pool = getDbPool();

    console.log('🔄 [ApplicationService] Updating application status:', {
      applicationId,
      status,
      updaterId,
      updaterType
    });

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

    console.log('📊 [ApplicationService] Status update result:', {
      rowsAffected: result.rowsAffected[0],
      applicationId
    });

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

  // NEW: Delete application (for employers)
  static async deleteApplication(applicationId: number, employerId: number): Promise<boolean> {
    const pool = getDbPool();

    console.log('🗑️ [ApplicationService] Deleting application:', {
      applicationId,
      employerId
    });

    const result = await pool.request()
      .input('application_id', sql.Int, applicationId)
      .input('employer_id', sql.Int, employerId)
      .query(`
        DELETE FROM Applications 
        FROM Applications a
        JOIN Jobs j ON a.job_id = j.id
        WHERE a.id = @application_id AND j.employer_id = @employer_id
      `);

    console.log('📊 [ApplicationService] Delete result:', {
      rowsAffected: result.rowsAffected[0],
      applicationId
    });

    return result.rowsAffected[0] > 0;
  }

  // NEW: Get application by ID with verification
  static async getApplicationById(applicationId: number): Promise<any> {
    const pool = getDbPool();
    
    const result = await pool.request()
      .input('application_id', sql.Int, applicationId)
      .query(`
        SELECT a.*, j.employer_id, j.title as job_title, u.name as employee_name
        FROM Applications a
        JOIN Jobs j ON a.job_id = j.id
        JOIN Users u ON a.employee_id = u.id
        WHERE a.id = @application_id
      `);
    
    return result.recordset.length > 0 ? result.recordset[0] : null;
  }
}