import multer from 'multer';

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB - generous for an avatar, small enough to prevent abuse

// Memory storage (not disk) - the file is only ever a Buffer in memory, processed and
// re-encoded by sharp before ever touching disk. Nothing from the client is written to
// disk verbatim.
const storage = multer.memoryStorage();

// This mimetype check is a fast first-pass filter only - it reads the client-supplied
// Content-Type header, which is NOT trustworthy on its own (trivially spoofable). The real
// validation happens in the controller, where sharp inspects the actual file bytes and
// will throw if the content isn't a genuine, decodable image. Both layers exist because
// rejecting obviously-wrong uploads here saves the cost of buffering + attempting to
// decode something that was never going to be valid.
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
