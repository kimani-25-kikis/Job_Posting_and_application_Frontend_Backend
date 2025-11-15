import { Hono } from 'hono';
import { ApplicationController } from './application.controller.ts';
import { employerRoleAuth, employeeRoleAuth } from '../middleware/bearAuth.ts';

const applicationRoutes = new Hono();

// Employee routes
applicationRoutes.post('/applications/apply', employeeRoleAuth, ApplicationController.applyForJob);
applicationRoutes.get('/employee/applications', employeeRoleAuth, ApplicationController.getEmployeeApplications);

// Employer routes
applicationRoutes.get('/employer/applications', employerRoleAuth, ApplicationController.getEmployerApplications);

// Both can update status (employer updates status, employee can withdraw)
applicationRoutes.patch('/applications/:id/status', employerRoleAuth, ApplicationController.updateApplicationStatus);

export default applicationRoutes;