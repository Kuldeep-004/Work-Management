import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

// Check if environment variables are set
const requiredEnvVars = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    console.error(`Missing required environment variable: ${varName}`);
  }
});

// Configure cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Upload image to cloudinary
export const uploadImage = async (filePath) => {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found at path: ${filePath}`);
    }

    // Upload the file with current timestamp
    const timestamp = Math.floor(Date.now() / 1000);
    const result = await cloudinary.uploader.upload(filePath, {
      folder: 'profile_pictures',
      width: 300,
      crop: "scale",
      resource_type: "auto",
      timestamp: timestamp,
      use_filename: true,
      unique_filename: true
    });

    return {
      public_id: result.public_id,
      url: result.secure_url
    };
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    // Check for specific error types
    if (error.message?.includes('Stale request')) {
      throw new Error('Upload failed due to time synchronization issue. Please try again.');
    }
    throw new Error(error.message || 'Error uploading image to Cloudinary');
  }
};

// Upload any file to cloudinary
export const uploadFile = async (filePath, folder = 'documents') => {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found at path: ${filePath}`);
    }

    // Upload the file with current timestamp
    const timestamp = Math.floor(Date.now() / 1000);
    const result = await cloudinary.uploader.upload(filePath, {
      folder: folder,
      resource_type: "auto",
      timestamp: timestamp,
      use_filename: true,
      unique_filename: true
    });

    return {
      public_id: result.public_id,
      url: result.secure_url
    };
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    // Check for specific error types
    if (error.message?.includes('Stale request')) {
      throw new Error('Upload failed due to time synchronization issue. Please try again.');
    }
    throw new Error(error.message || 'Error uploading file to Cloudinary');
  }
};

// Delete image from cloudinary
export const deleteImage = async (public_id) => {
  try {
    if (public_id) {
      const result = await cloudinary.uploader.destroy(public_id);
      if (result.result !== 'ok') {
        throw new Error(`Failed to delete image: ${result.result}`);
      }
    }
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    throw new Error(error.message || 'Error deleting image from Cloudinary');
  }
}; 