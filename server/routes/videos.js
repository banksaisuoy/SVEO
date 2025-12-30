const express = require('express');
const { Database, Video, Log } = require('../models/index');
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

// Get all videos
router.get('/', async (req, res) => {
    try {
        const db = await initDatabase();
        const videos = await Video.getAll(db);
        res.json({ success: true, videos });
    } catch (error) {
        console.error('Get videos error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get featured videos
router.get('/featured', async (req, res) => {
    try {
        const db = await initDatabase();
        const videos = await Video.getFeatured(db);
        res.json({ success: true, videos });
    } catch (error) {
        console.error('Get featured videos error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get trending videos
router.get('/trending', async (req, res) => {
    try {
        const db = await initDatabase();
        const limit = parseInt(req.query.limit) || 4;
        const videos = await Video.getTrending(db, limit);
        res.json({ success: true, videos });
    } catch (error) {
        console.error('Get trending videos error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Search videos
router.get('/search', async (req, res) => {
    try {
        const db = await initDatabase();
        const { q: query } = req.query;

        if (!query || query.length < 2) {
            return res.status(400).json({ error: 'Search query must be at least 2 characters' });
        }

        const videos = await Video.search(db, query);
        res.json({ success: true, videos });
    } catch (error) {
        console.error('Search videos error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get single video by ID
router.get('/:id', async (req, res) => {
    try {
        const db = await initDatabase();
        const { id } = req.params;
        const video = await Video.getById(db, id);

        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }

        res.json({ success: true, video });
    } catch (error) {
        console.error('Get video error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Increment video views
router.post('/:id/view', authenticateToken, async (req, res) => {
    try {
        const db = await initDatabase();
        const { id } = req.params;

        // Check if video exists
        const video = await Video.getById(db, id);
        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }

        await Video.incrementViews(db, id);
        await Log.create(db, req.user.username, 'View Video', `Viewed video ID: ${id}, Title: ${video.title}`);

        res.json({ success: true, message: 'View recorded' });
    } catch (error) {
        console.error('Increment views error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create new video (admin only)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = await initDatabase();
        const { title, description, thumbnailUrl, videoUrl, categoryId, isFeatured } = req.body;

        if (!title || !videoUrl || !categoryId) {
            return res.status(400).json({ error: 'Title, video URL, and category are required' });
        }

        const result = await Video.create(db, {
            title,
            description,
            thumbnailUrl,
            videoUrl,
            categoryId,
            isFeatured: !!isFeatured
        });

        await Log.create(db, req.user.username, 'Add Video', `Added new video: ${title}`);

        res.status(201).json({
            success: true,
            message: 'Video created successfully',
            videoId: result.id
        });
    } catch (error) {
        console.error('Create video error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update video (admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = await initDatabase();
        const { id } = req.params;
        const { title, description, thumbnailUrl, videoUrl, categoryId, isFeatured } = req.body;

        // Check if video exists
        const existingVideo = await Video.getById(db, id);
        if (!existingVideo) {
            return res.status(404).json({ error: 'Video not found' });
        }

        // For updates, we don't require all fields to be present
        // Only require title (categoryId will use existing if not provided)
        if (!title) {
            return res.status(400).json({ error: 'Title is required' });
        }

        // Use existing values if new ones are not provided
        const updateData = {
            title,
            description: description !== undefined ? description : existingVideo.description,
            thumbnailUrl: thumbnailUrl || existingVideo.thumbnailUrl,
            videoUrl: videoUrl || existingVideo.videoUrl,
            categoryId: categoryId || existingVideo.categoryId,
            isFeatured: isFeatured !== undefined ? !!isFeatured : !!existingVideo.isFeatured
        };

        await Video.update(db, id, updateData);

        await Log.create(db, req.user.username, 'Update Video', `Updated video ID: ${id}`);

        res.json({ success: true, message: 'Video updated successfully' });
    } catch (error) {
        console.error('Update video error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete video (admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = await initDatabase();
        const { id } = req.params;

        // Check if video exists
        const existingVideo = await Video.getById(db, id);
        if (!existingVideo) {
            return res.status(404).json({ error: 'Video not found' });
        }

        await Video.delete(db, id);
        await Log.create(db, req.user.username, 'Delete Video', `Deleted video ID: ${id}`);

        res.json({ success: true, message: 'Video deleted successfully' });
    } catch (error) {
        console.error('Delete video error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;