import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';

const PCLOUD_TOKEN = process.env.PCLOUD_TOKEN;
const PCLOUD_API = 'https://api.pcloud.com';
const PCLOUD_PUBLIC_PROFILE_FOLDER_ID = process.env.PCLOUD_PUBLIC_PROFILE_FOLDER_ID;
const PCLOUD_PUBLIC_FILES_FOLDER_ID = process.env.PCLOUD_PUBLIC_FILES_FOLDER_ID;

async function getOrCreateFolder(folder) {
  if (!folder) return 0;
 // root
  // Only upload to existing folders, do not create
  try {
    const listRes = await axios.get(`${PCLOUD_API}/listfolder`, {
      params: { auth: PCLOUD_TOKEN, path: `/${folder}` }
    });
    if (listRes.data.result === 0 && listRes.data.metadata?.folderid) {
      return listRes.data.metadata.folderid;
    } else {
      throw new Error(`Folder '${folder}' does not exist in pCloud.`);
    }
  } catch (err) {
    throw new Error(`Folder '${folder}' does not exist in pCloud. Details: ${err.response?.data?.error || err.message}`);
  }
}

export const uploadFile = async (filePath, type = 'files') => {
  try {
    if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
    let folderId;
    if (type === 'profile') {
      folderId = PCLOUD_PUBLIC_PROFILE_FOLDER_ID;
    } else {
      folderId = PCLOUD_PUBLIC_FILES_FOLDER_ID;
    }
    const filename = filePath.split('/').pop();
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    form.append('filename', filename);

    const uploadRes = await axios.post(
      `https://api.pcloud.com/uploadfile?auth=${PCLOUD_TOKEN}&folderid=${folderId}`,
      form,
      {
        headers: form.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );

    // Safe handling of metadata
    const meta = uploadRes.data?.metadata;
    let fileMeta = null;
    if (Array.isArray(meta)) {
      if (meta.length > 0) {
        fileMeta = meta[0];
      } else {
        throw new Error('Upload failed: metadata array is empty');
      }
    } else if (meta && typeof meta === 'object' && meta.fileid) {
      fileMeta = meta;
    } else {
      throw new Error(`Upload failed: metadata is missing or malformed. Received metadata: ${JSON.stringify(meta)}`);
    }

    // Construct the public URL for Public Folder files using filedn.com hash
    const publicHash = 'lwPvPL31jQvXObDsULFwm7L'; // pCloud Public Folder hash
    const subfolder = type === 'profile' ? 'Profile' : 'Files';
    const publicUrl = `https://filedn.com/${publicHash}/${subfolder}/${fileMeta.name}`;

    return {
      public_id: fileMeta?.fileid,
      url: publicUrl,
    };
  } catch (error) {
    console.error('pCloud upload error:', error.response?.data || error);
    throw new Error(error.message || 'Upload to pCloud failed');
  }
};

export const uploadImage = async (filePath) => {
  return uploadFile(filePath, 'profile');
};

export const deleteFile = async (public_id) => {
  try {
    if (public_id) {
      await axios.get(`${PCLOUD_API}/deletefile`, {
        params: { auth: PCLOUD_TOKEN, fileid: public_id }
      });
    }
  } catch (error) {
    throw new Error(error.message || 'Error deleting file from pCloud');
  }
};
