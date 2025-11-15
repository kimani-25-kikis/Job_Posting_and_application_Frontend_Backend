import { Hono } from 'hono';
import { FileUploadService } from '../upload/upload.service.ts';
import { employeeRoleAuth } from '../middleware/bearAuth.ts';

const uploadRoutes = new Hono();

uploadRoutes.post('/upload/resume', employeeRoleAuth, async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('resume') as File;
    
    if (!file) {
      return c.json({ success: false, error: 'No file provided' }, 400);
    }

    const uploadedFile = await FileUploadService.saveFile(file);
    
    return c.json({
      success: true,
      data: {
        filename: uploadedFile.filename,
        originalName: uploadedFile.originalName,
        url: `/uploads/resumes/${uploadedFile.filename}`,
        size: uploadedFile.size
      }
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return c.json({ 
      success: false, 
      error: error.message || 'Upload failed' 
    }, 500);
  }
});

export default uploadRoutes;