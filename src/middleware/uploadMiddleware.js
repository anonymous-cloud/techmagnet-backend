const multer = require('multer');

const storage = multer.memoryStorage();

const csvFileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
   'text/csv',
  'application/vnd.ms-excel',
  'text/plain',
  'application/octet-stream'
  ];

  const fileExtension = file.originalname ? file.originalname.toLowerCase().endsWith('.csv') : false;

  if (!fileExtension || !allowedMimeTypes.includes(file.mimetype)) {
    return cb(new Error('Only CSV files are allowed'));
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter: csvFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max file size
  }
});

const csvUpload = (req, res, next) => {
  const handler = upload.single('file');

  handler(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'FILE_UPLOAD_ERROR',
          message: err.message || 'CSV upload failed'
        }
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'FILE_REQUIRED',
          message: 'CSV file is required'
        }
      });
    }

    next();
  });
};

module.exports = { csvUpload };