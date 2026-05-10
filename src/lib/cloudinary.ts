import axios from 'axios';

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export const uploadToCloudinary = async (file: File, onProgress?: (progress: number) => void): Promise<string> => {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error('Cloudinary configuration is missing. Please check your environment variables.');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);

  try {
    const response = await axios.post(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`,
      formData,
      {
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(percentCompleted);
          }
        },
        // Increase timeout for large files on slow connections
        timeout: 600000, // 10 minutes
      }
    );

    return response.data.secure_url;
  } catch (error: any) {
    console.error('Cloudinary Upload Error Details:', error);
    
    let errorMessage = 'Failed to upload file to Cloudinary';
    
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      errorMessage = `Cloudinary Error: ${error.response.data.error?.message || error.response.statusText}`;
      console.error('Data:', error.response.data);
    } else if (error.request) {
      // The request was made but no response was received
      errorMessage = 'Network Error: No response from Cloudinary. Check your internet connection.';
    } else {
      // Something happened in setting up the request that triggered an Error
      errorMessage = error.message;
    }
    
    throw new Error(errorMessage);
  }
};
