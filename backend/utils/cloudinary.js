import ImageKit from 'imagekit';
import fs from 'fs';
import path from 'path';


const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

// Helper to get file extension
const getFileExtension = (filePath) => path.extname(filePath).slice(1);

// Upload image or file to ImageKit
export const uploadImage = async (filePath) => {
  return uploadFile(filePath, 'profile_pictures');
};

export const uploadFile = async (filePath, folder = 'documents', mimetype = null) => {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found at path: ${filePath}`);
    }
    const fileName = path.basename(filePath);
    const fileBuffer = fs.readFileSync(filePath);
    const uploadOptions = {
      file: fileBuffer,
      fileName: fileName,
      folder: folder,
      useUniqueFileName: true,
    };
    if (mimetype) {
      uploadOptions.mime = mimetype;
    }
    const result = await imagekit.upload(uploadOptions);
    return {
      public_id: result.fileId,
      url: result.url
    };
  } catch (error) {
    throw new Error(error.message || 'Error uploading file to ImageKit');
  }
};

// Delete file from ImageKit
export const deleteImage = async (public_id) => {
  try {
    if (public_id) {
      const result = await imagekit.deleteFile(public_id);
      if (!result || result.error) {
        throw new Error(`Failed to delete image: ${result.error?.message || 'Unknown error'}`);
      }
    }
  } catch (error) {
    throw new Error(error.message || 'Error deleting image from ImageKit');
  }
}; 