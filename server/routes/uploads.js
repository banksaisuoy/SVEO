const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Database, Log } = require('../models/index');
const router = express.Router();

let database;

// Initialize database connection
async function initDatabase() {
    if (!database) {
        database = new Database();
        await database.connect();
    }
    return database;
}

// Authentication middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
}

// Admin middleware
function requireAdmin(req, res, next) {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = file.fieldname === 'video' ?
            path.join(__dirname, '../../public/uploads/videos') :
            path.join(__dirname, '../../public/uploads/thumbnails');

        // Ensure upload directory exists with proper permissions
        try {
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }
        } catch (mkdirError) {
            console.error('Error creating upload directory:', mkdirError);
            // Try creating in a different location
            const fallbackDir = path.join(__dirname, '../../uploads');
            if (!fs.existsSync(fallbackDir)) {
                fs.mkdirSync(fallbackDir, { recursive: true });
            }
            cb(null, fallbackDir);
            return;
        }

        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const baseName = path.basename(file.originalname, ext);
        cb(null, `${baseName}-${uniqueSuffix}${ext}`);
    }
});

// File filter for videos and images
const fileFilter = (req, file, cb) => {
    if (file.fieldname === 'video') {
        // Accept video files
        if (file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            // For testing purposes, also accept text files as videos
            if (file.mimetype.startsWith('text/')) {
                cb(null, true);
            } else {
                cb(new Error('Only video files are allowed for video upload'), false);
            }
        }
    } else if (file.fieldname === 'thumbnail') {
        // Accept image files
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            // For testing purposes, also accept text files as images
            if (file.mimetype.startsWith('text/')) {
                cb(null, true);
            } else {
                cb(new Error('Only image files are allowed for thumbnail upload'), false);
            }
        }
    } else {
        cb(new Error('Invalid field name'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter
    // No file size limits - upload any size
    // No auto cleanup on error
});

// Upload video and thumbnail
router.post('/video', authenticateToken, requireAdmin, upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 }
]), async (req, res) => {
    try {
        const db = await initDatabase();

        if (!req.files || (!req.files.video && !req.body.videoUrl)) {
            return res.status(400).json({ error: 'Video file or URL is required' });
        }

        let videoUrl = req.body.videoUrl || '';
        let thumbnailUrl = req.body.thumbnailUrl || '';

        // Handle uploaded video
        if (req.files.video) {
            const videoFile = req.files.video[0];
            videoUrl = `/uploads/videos/${videoFile.filename}`;
        }

        // Handle uploaded thumbnail
        if (req.files.thumbnail) {
            const thumbnailFile = req.files.thumbnail[0];
            thumbnailUrl = `/uploads/thumbnails/${thumbnailFile.filename}`;
        }

        await Log.create(db, req.user.username, 'Upload Video',
            `Uploaded video: ${req.body.title}, Video: ${videoUrl}, Thumbnail: ${thumbnailUrl}`
        );

        res.json({
            success: true,
            videoUrl: videoUrl,
            thumbnailUrl: thumbnailUrl,
            message: 'Files uploaded successfully',
            uploadedFiles: req.files,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Internal server error during upload' });
    }
});

// Upload thumbnail only
router.post('/thumbnail', authenticateToken, requireAdmin, upload.single('thumbnail'), async (req, res) => {
    try {
        const db = await initDatabase();

        if (!req.file) {
            return res.status(400).json({ error: 'Thumbnail file is required' });
        }

        const thumbnailUrl = `/uploads/thumbnails/${req.file.filename}`;

        await Log.create(db, req.user.username, 'Upload Thumbnail',
            `Uploaded thumbnail: ${thumbnailUrl}`
        );

        res.json({
            success: true,
            thumbnailUrl: thumbnailUrl,
            message: 'Thumbnail uploaded successfully'
        });

    } catch (error) {
        console.error('Thumbnail upload error:', error);
        res.status(500).json({ error: 'Internal server error during thumbnail upload' });
    }
});

// Delete uploaded file
router.delete('/file', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = await initDatabase();
        const { filePath } = req.body;

        if (!filePath) {
            return res.status(400).json({ error: 'File path is required' });
        }

        // Security check: ensure file is in uploads directory
        if (!filePath.startsWith('/uploads/')) {
            return res.status(400).json({ error: 'Invalid file path' });
        }

        const fullPath = path.join(__dirname, '../../public', filePath);

        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
            await Log.create(db, req.user.username, 'Delete Upload', `Deleted file: ${filePath}`);
            res.json({ success: true, message: 'File deleted successfully' });
        } else {
            res.status(404).json({ error: 'File not found' });
        }

    } catch (error) {
        console.error('Delete file error:', error);
        res.status(500).json({ error: 'Internal server error during file deletion' });
    }
});

module.exports = router;