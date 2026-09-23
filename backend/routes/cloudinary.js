const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { uploadToCloudinary } = require('../utils/cloudinaryUtils');

// Configure multer for temporary file storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads');
    
    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter - only allow specific file types
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'video/mp4',
    'video/avi',
    'video/x-msvideo',
    'video/mov',
    'video/quicktime'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type: ${file.mimetype}. Only PDF, JPEG, PNG, MP4, AVI, and MOV files are allowed.`), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
  },
  fileFilter: fileFilter
});

/**
 * POST /api/cloudinary/upload
 * Upload a single file to Cloudinary
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('Uploading file to Cloudinary:', req.file.filename);

    // Upload to Cloudinary
    const cloudinaryResult = await uploadToCloudinary(req.file.path, 'grievances');

    // Delete the temporary file after upload
    fs.unlink(req.file.path, (err) => {
      if (err) {
        console.error('Error deleting temporary file:', err);
      } else {
        console.log('Temporary file deleted:', req.file.path);
      }
    });

    if (!cloudinaryResult.success) {
      return res.status(500).json({ 
        error: 'Failed to upload to Cloudinary',
        details: cloudinaryResult.error 
      });
    }

    res.json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        url: cloudinaryResult.url,
        publicId: cloudinaryResult.publicId,
        format: cloudinaryResult.format,
        resourceType: cloudinaryResult.resourceType,
        size: cloudinaryResult.size,
        originalName: req.file.originalname
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    
    // Clean up temp file if it exists
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, () => {});
    }
    
    res.status(500).json({ 
      error: 'Upload failed',
      message: error.message 
    });
  }
});

/**
 * POST /api/cloudinary/upload-multiple
 * Upload multiple files to Cloudinary
 */
router.post('/upload-multiple', upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    console.log(`Uploading ${req.files.length} files to Cloudinary`);

    const uploadPromises = req.files.map(async (file) => {
      const cloudinaryResult = await uploadToCloudinary(file.path, 'grievances');
      
      // Delete the temporary file after upload
      fs.unlink(file.path, (err) => {
        if (err) {
          console.error('Error deleting temporary file:', err);
        }
      });

      return {
        originalName: file.originalname,
        ...cloudinaryResult
      };
    });

    const results = await Promise.all(uploadPromises);

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    res.json({
      success: true,
      message: `Uploaded ${successful.length} file(s) successfully`,
      data: {
        uploaded: successful,
        failed: failed.length > 0 ? failed : undefined
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    
    // Clean up temp files if they exist
    if (req.files) {
      req.files.forEach(file => {
        if (file.path) {
          fs.unlink(file.path, () => {});
        }
      });
    }
    
    res.status(500).json({ 
      error: 'Upload failed',
      message: error.message 
    });
  }
});

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        error: 'File too large',
        message: 'File size must be less than 10MB' 
      });
    }
    return res.status(400).json({ 
      error: 'Upload error',
      message: error.message 
    });
  }
  
  if (error.message && error.message.includes('Invalid file type')) {
    return res.status(400).json({ 
      error: 'Invalid file type',
      message: error.message 
    });
  }
  
  next(error);
});

module.exports = router;
