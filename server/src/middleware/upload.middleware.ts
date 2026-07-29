import multer from 'multer';

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; 

const storage = multer.memoryStorage();


const ALLOWED_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const avatarUpload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIMETYPES.includes(file.mimetype)) {
      cb(new Error('Only JPEG, PNG, or WEBP images are allowed'));
      return;
    }
    cb(null, true);
  },
});
