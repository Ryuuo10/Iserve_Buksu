/**
 * Cloudinary Service - Handle file uploads to Cloudinary
 */

import API_BASE_URL from '../config/api';

/**
 * Upload a single file to Cloudinary
 * @param {File} file - The file to upload
 * @returns {Promise<object>} - Upload result with URL and metadata
 */
const uploadFileToCloudinary = async (file) => {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/cloudinary/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Upload failed');
    }

    const data = await response.json();
    return {
      success: true,
      url: data.data.url,
      publicId: data.data.publicId,
      format: data.data.format,
      resourceType: data.data.resourceType,
      size: data.data.size,
      originalName: data.data.originalName,
    };
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Upload multiple files to Cloudinary
 * @param {Array<File>} files - Array of files to upload
 * @returns {Promise<Array>} - Array of upload results
 */
const uploadMultipleFilesToCloudinary = async (files) => {
  try {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    const response = await fetch(`${API_BASE_URL}/cloudinary/upload-multiple`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Upload failed');
    }

    const data = await response.json();
    return data.data.uploaded || [];
  } catch (error) {
    console.error('Cloudinary batch upload error:', error);
    // Fallback to individual uploads
    const results = await Promise.all(
      files.map(file => uploadFileToCloudinary(file))
    );
    return results;
  }
};

export default {
  uploadFileToCloudinary,
  uploadMultipleFilesToCloudinary,
};
