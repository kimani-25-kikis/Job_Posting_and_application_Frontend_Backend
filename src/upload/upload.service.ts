import path from 'path';
import fs from 'fs';
import { randomBytes } from 'crypto';

export interface UploadedFile {
  filename: string;
  originalName: string;
  path: string;
  size: number;
  mimetype: string;
}

export class FileUploadService {
  private static uploadDir = path.join(process.cwd(), 'uploads', 'resumes');

  static async saveFile(file: File): Promise<UploadedFile> {
    // Ensure upload directory exists
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Only PDF and Word documents are allowed');
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('File size must be less than 5MB');
    }

    // Generate unique filename
    const fileExtension = path.extname(file.name);
    const randomName = randomBytes(16).toString('hex');
    const filename = `${randomName}${fileExtension}`;
    const filePath = path.join(this.uploadDir, filename);

    // Convert File to Buffer and save
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    fs.writeFileSync(filePath, buffer);

    return {
      filename,
      originalName: file.name,
      path: filePath,
      size: file.size,
      mimetype: file.type
    };
  }

  static getResumeUrl(filename: string): string {
    return `/uploads/resumes/${filename}`;
  }

  static deleteFile(filename: string): boolean {
    try {
      const filePath = path.join(this.uploadDir, filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting file:', error);
      return false;
    }
  }
}