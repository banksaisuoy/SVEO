const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const videoController = require('../controllers/videoController');
const { isAuthenticated, isAdmin } = require('../middleware/authMiddleware');

// --- Multer Configuration ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/videos/');
    },
    filename: function (req, file, cb) {
        // Create a unique filename to avoid overwrites
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });
// --------------------------


// GET /api/videos - Public, but will have logic inside controller for permissions
router.get('/', videoController.getAllVideos);

// POST /api/videos - Admin only, for URL-based videos
router.post('/', isAuthenticated, isAdmin, videoController.createVideo);

// POST /api/videos/upload - Admin only, for file uploads
router.post('/upload', isAuthenticated, isAdmin, upload.single('videoFile'), videoController.uploadVideo);

// DELETE /api/videos/:id - Admin only
router.delete('/:id', isAuthenticated, isAdmin, videoController.deleteVideo);

module.exports = router;
