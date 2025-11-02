import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { uploadFile, uploadImage } from '../utils/cloudinary.js';

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

// File filter for chat files (including audio)
const chatFileFilter = (req, file, cb) => {
  const allowedTypes = [
    // Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    
    // Audio
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/ogg',
    'audio/m4a',
    'audio/webm',
    
    // Video
    'video/mp4',
    'video/mpeg',
    'video/quicktime',
    'video/webm',
    
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    
    // Other common files
    'application/zip',
    'application/x-zip-compressed',
    'application/json',
    'text/csv'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(null, true); // Allow all file types for chat
  }
};

// Create multer instances for different purposes
const uploadPhoto = multer({
  storage: storage,
  fileFilter: photoFilter,
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB limit for photos (increased from 5MB)
  }
}).single('photo');

const uploadChatFile = multer({
  storage: storage,
  fileFilter: chatFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit for chat files
  }
}).single('file');

const uploadChatAvatar = multer({
  storage: storage,
  fileFilter: photoFilter,
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB limit for avatars (increased from 5MB)
  }
}).single('avatar');

const uploadTaskFiles = multer({
  storage: storage,
  fileFilter: taskFileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit for task files (increased from 10MB)
    files: 10 // Maximum 10 files at once
  }
});

// Wrapper middleware for profile photo upload
export const uploadMiddleware = (req, res, next) => {
  uploadPhoto(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          message: 'File is too large. Maximum size is 20MB'
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

// Chat file upload middleware  
export const uploadChatFileMiddleware = (req, res, next) => {
  uploadChatFile(req, res, async function (err) {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          message: 'File is too large. Maximum size is 50MB'
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

    // Upload to pCloud if file exists
    if (req.file) {
      try {
        const uploadResult = await uploadFile(req.file.path, 'files');
        
        // Add cloud storage info to req.file
        req.file.public_id = uploadResult.public_id;
        req.file.secure_url = uploadResult.url;
        req.file.original_filename = req.file.originalname;
        req.file.bytes = req.file.size;
        req.file.mimetype = req.file.mimetype;
        
        // Clean up local file
        fs.unlinkSync(req.file.path);
        
      } catch (uploadError) {
        // Clean up local file on error
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(500).json({
          message: 'Error uploading file to cloud storage'
        });
      }
    }
    
    next();
  });
};

// Chat avatar upload middleware
export const uploadChatAvatarMiddleware = (req, res, next) => {
  uploadChatAvatar(req, res, async function (err) {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          message: 'Avatar is too large. Maximum size is 20MB'
        });
      }
      return res.status(400).json({
        message: `Upload error: ${err.message}`
      });
    } else if (err) {
      return res.status(400).json({
        message: err.message || 'Error uploading avatar'
      });
    }

    // Upload to pCloud if file exists
    if (req.file) {
      try {
        const uploadResult = await uploadImage(req.file.path);
        
        // Add cloud storage info to req.file
        req.file.public_id = uploadResult.public_id;
        req.file.secure_url = uploadResult.url;
        
        // Clean up local file
        fs.unlinkSync(req.file.path);
        
      } catch (uploadError) {
        // Clean up local file on error
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(500).json({
          message: 'Error uploading avatar to cloud storage'
        });
      }
    }
    
    next();
  });
};

// Create multer instance for comment files
const uploadCommentFiles = multer({
  storage: storage,
  fileFilter: taskFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// Export task file upload instance
export const uploadTaskFilesMiddleware = uploadTaskFiles.array('files', 10);

// Export comment file upload instance
export const uploadCommentFilesMiddleware = uploadCommentFiles.array('files', 5);

// Export default for backward compatibility
export default uploadTaskFilesMiddleware; 