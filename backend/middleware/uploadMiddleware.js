import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Create unique filename with original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter for profile photos
const photoFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed for profile photos'), false);
  }
};

// File filter for task files
const taskFileFilter = (req, file, cb) => {
  const allowedTypes = [
    // PDF files
    'application/pdf',
    
    // Microsoft Word files
    'application/msword', // .doc
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    
    // Microsoft Excel files
    'application/vnd.ms-excel', // .xls
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    
    // Microsoft PowerPoint files
    'application/vnd.ms-powerpoint', // .ppt
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
    
    // Images
    'image/jpeg',
    'image/png',
    
    // Text files
    'text/plain',
    
    // Additional Office formats
    'application/vnd.ms-office',
    'application/vnd.oasis.opendocument.text', // OpenDocument Text
    'application/vnd.oasis.opendocument.spreadsheet', // OpenDocument Spreadsheet
    'application/vnd.oasis.opendocument.presentation' // OpenDocument Presentation
  ];

  // Get file extension
  const ext = file.originalname.split('.').pop().toLowerCase();
  const allowedExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'txt', 'odt', 'ods', 'odp'];

  if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Allowed types: PDF, Word, Excel, PowerPoint, images, and text files.'), false);
  }
};

// Create multer instances for different purposes
const uploadPhoto = multer({
  storage: storage,
  fileFilter: photoFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit for photos
  }
}).single('photo');

const uploadTaskFiles = multer({
  storage: storage,
  fileFilter: taskFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit for task files
  }
});

// Wrapper middleware for profile photo upload
export const uploadMiddleware = (req, res, next) => {
  uploadPhoto(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          message: 'File is too large. Maximum size is 5MB'
        });
      }
      return res.status(400).json({
        message: `Upload error: ${err.message}`
      });
    } else if (err) {
      return res.status(400).json({
        message: err.message || 'Error uploading file'
      });
    }
    next();
  });
};

// Export task file upload instance
export const uploadTaskFilesMiddleware = uploadTaskFiles.array('files', 10);

// Export default for backward compatibility
export default uploadTaskFilesMiddleware; 