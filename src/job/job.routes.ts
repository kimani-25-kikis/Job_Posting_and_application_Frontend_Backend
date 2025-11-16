import { Hono } from 'hono';
import { JobController } from './job.controller.ts';
import { employerRoleAuth, bothRolesAuth } from '../middleware/bearAuth.ts';

const jobRoutes = new Hono();

// Public routes
jobRoutes.get('/jobs', JobController.getAllJobs);
jobRoutes.get('/jobs/:id', JobController.getJob);

// Employer only routes
jobRoutes.post('/jobs', employerRoleAuth, JobController.createJob);
jobRoutes.get('/employer/jobs', employerRoleAuth, JobController.getEmployerJobs);
jobRoutes.put('/jobs/:id', employerRoleAuth, JobController.updateJob); // Add this
jobRoutes.delete('/jobs/:id', employerRoleAuth, JobController.deleteJob); // Add this

export default jobRoutes;