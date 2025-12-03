import sql from 'mssql';
import { getDbPool } from '../db/db.config.ts';
import { AuthService } from '../auth/auth.services.ts';

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

  // 1. FIRST get application details WITH employee email
  // const appDetailsResult = await pool.request()
  //   .input('application_id', sql.Int, applicationId)
  //   .query(`
  //     SELECT 
  //       a.*,
  //       empUser.email as employee_email,
  //       empUser.name as employee_name,
  //       j.title as job_title,
  //       employerUser.name as employer_name,
  //       j.employer_id
  //     FROM Applications a
  //     JOIN Jobs j ON a.job_id = j.id
  //     JOIN Users empUser ON a.employee_id = empUser.id
  //     JOIN Users employerUser ON j.employer_id = employerUser.id
  //     WHERE a.id = @application_id
  //   `);
  // 1. FIRST get application details WITH employee email
const appDetailsResult = await pool.request()
  .input('application_id', sql.Int, applicationId)
  .query(`
    SELECT 
      a.*,
      empUser.email as employee_email,
      empUser.name as employee_name,
      j.title as job_title,
      employerUser.name as employer_name,
      j.employer_id,
      a.employee_id
    FROM Applications a
    INNER JOIN Jobs j ON a.job_id = j.id
    INNER JOIN Users empUser ON a.employee_id = empUser.id
    INNER JOIN Users employerUser ON j.employer_id = employerUser.id
    WHERE a.id = @application_id
  `);

  if (appDetailsResult.recordset.length === 0) {
    console.warn('⚠️ [ApplicationService] Application not found:', applicationId);
    return false;
  }

  const appDetails = appDetailsResult.recordset[0];
  
  // 2. Security check: Verify updater has permission
  let canUpdate = false;
  let query = '';

  if (updaterType === 'employer') {
    // Employer can only update their own job's applications
    if (appDetails.employer_id === updaterId) {
      canUpdate = true;
      query = `
        UPDATE Applications 
        SET status = @status, updated_at = GETDATE()
        FROM Applications a
        JOIN Jobs j ON a.job_id = j.id
        WHERE a.id = @application_id AND j.employer_id = @updater_id
      `;
    }
  } else {
    // Employee can only update their own applications
    if (appDetails.employee_id === updaterId) {
      canUpdate = true;
      query = `
        UPDATE Applications 
        SET status = @status, updated_at = GETDATE()
        WHERE id = @application_id AND employee_id = @updater_id
      `;
    }
  }

  if (!canUpdate) {
    console.error('🚫 [ApplicationService] Unauthorized status update attempt:', {
      applicationId,
      updaterId,
      updaterType,
      requiredEmployerId: appDetails.employer_id,
      requiredEmployeeId: appDetails.employee_id
    });
    return false;
  }

  // 3. Execute the update
  const updateResult = await pool.request()
    .input('application_id', sql.Int, applicationId)
    .input('status', sql.NVarChar, status)
    .input('updater_id', sql.Int, updaterId)
    .query(query);

  const updated = updateResult.rowsAffected[0] > 0;

  if (updated) {
    console.log('✅ [ApplicationService] Status updated successfully:', {
      applicationId,
      newStatus: status,
      employeeEmail: appDetails.employee_email
    });

    // 4. Send email for important status changes (only if employer is updating)
    if (updaterType === 'employer' && ['shortlisted', 'accepted', 'rejected'].includes(status)) {
      try {
    // Type assertion to fix the error
    const emailStatus = status as 'shortlisted' | 'accepted' | 'rejected';
    
    await AuthService.sendStatusUpdateEmail(
      applicationId,
      emailStatus, // Fixed type
      appDetails.job_title,
      appDetails.employer_name,
      appDetails.employee_email,
      appDetails.employee_name
    );
    console.log('📧 [ApplicationService] Status email sent successfully');
  }catch (emailError) {
        console.error('📧 [ApplicationService] Failed to send status email:', emailError);
        // Don't fail the update if email fails
      }
    }
  }

  return updated;
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