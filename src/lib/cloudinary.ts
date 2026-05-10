import axios from 'axios';

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export const uploadToCloudinary = async (file: File, onProgress?: (progress: number) => void): Promise<string> => {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error('Cloudinary configuration is missing. Please check your environment variables.');
  }

  // Use chunked upload for files larger than 5MB
  const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
  if (file.size > CHUNK_SIZE) {
    return uploadLargeFile(file, onProgress);
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('resource_type', 'auto');

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
        timeout: 600000, // 10 minutes
      }
    );

    return response.data.secure_url;
  } catch (error: any) {
    return handleUploadError(error);
  }
};

const uploadLargeFile = async (file: File, onProgress?: (progress: number) => void): Promise<string> => {
  const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const uniqueId = Math.random().toString(36).substring(2, 15);
  let secureUrl = '';

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);

    const formData = new FormData();
    formData.append('file', chunk);
    formData.append('upload_preset', UPLOAD_PRESET!);
    formData.append('resource_type', 'auto');

    try {
      const response = await axios.post(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`,
        formData,
        {
          headers: {
            'X-Unique-Upload-Id': uniqueId,
            'Content-Range': `bytes ${start}-${end - 1}/${file.size}`,
          },
          onUploadProgress: (progressEvent) => {
            if (onProgress && progressEvent.total) {
              const chunkProgress = (progressEvent.loaded / progressEvent.total);
              const totalProgress = ((i + chunkProgress) / totalChunks) * 100;
              onProgress(Math.round(totalProgress));
            }
          },
          timeout: 300000, // 5 minutes per chunk
        }
      );
      
      if (response.data.secure_url) {
        secureUrl = response.data.secure_url;
      }
    } catch (error: any) {
      return handleUploadError(error);
    }
  }

  return secureUrl;
};

const handleUploadError = (error: any) => {
  console.error('Cloudinary Upload Error Details:', error);
  
  let errorMessage = 'Failed to upload file to Cloudinary';
  
  if (error.response) {
    errorMessage = `Cloudinary Error: ${error.response.data.error?.message || error.response.statusText}`;
    console.error('Data:', error.response.data);
  } else if (error.request) {
    errorMessage = 'Network Error: No response from Cloudinary. This often happens on unstable connections or if the file is too large. Please try again or use a faster connection.';
  } else {
    errorMessage = error.message;
  }
  
  throw new Error(errorMessage);
};
