const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadsDir = path.join(__dirname, '..', 'public', 'uploads', 'videos');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'video/mp4' || file.mimetype === 'video/webm') {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only MP4 and WebM are allowed.'), false);
    }
};

const UPLOAD_MAX_BYTES = 100 * 1024 * 1024; // 100MB as specified

const upload = multer({ 
    storage, 
    limits: { fileSize: UPLOAD_MAX_BYTES },
    fileFilter
});

module.exports = upload;