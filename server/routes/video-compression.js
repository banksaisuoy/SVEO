const express = require('express');
const videoCompressionService = require('../services/videoCompression');
const router = express.Router();

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

// Get video compression service status
router.get('/status', authenticateToken, requireAdmin, (req, res) => {
    try {
        const status = videoCompressionService.getStatus();
        res.json({
            success: true,
            compression: status
        });
    } catch (error) {
        console.error('Compression status error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Optimize a single video for web delivery
router.post('/optimize/:videoId', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { videoId } = req.params;
        const db = req.app.get('db');

        // Validate video ID
        const videoIdNum = parseInt(videoId);
        if (isNaN(videoIdNum)) {
            return res.status(400).json({ error: 'Invalid video ID' });
        }

        const result = await videoCompressionService.optimizeForWeb(videoIdNum, db);

        if (result.success) {
            res.json({
                success: true,
                optimization: result
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error,
                message: result.message
            });
        }
    } catch (error) {
        console.error('Video optimization error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Batch optimize multiple videos
router.post('/batch-optimize', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { videoIds } = req.body;
        const db = req.app.get('db');

        // Validate input
        if (!videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
            return res.status(400).json({ error: 'Video IDs array required' });
        }

        // Validate all IDs are numbers
        const validIds = videoIds.filter(id => !isNaN(parseInt(id)));
        if (validIds.length !== videoIds.length) {
            return res.status(400).json({ error: 'All video IDs must be valid numbers' });
        }

        const result = await videoCompressionService.batchOptimize(validIds, db);

        res.json({
            success: true,
            batchOptimization: result
        });
    } catch (error) {
        console.error('Batch optimization error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Generate thumbnail for a video
router.post('/thumbnail/:videoId', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { videoId } = req.params;
        const { timestamp = '00:00:01' } = req.body;
        const db = req.app.get('db');

        // Validate video ID
        const videoIdNum = parseInt(videoId);
        if (isNaN(videoIdNum)) {
            return res.status(400).json({ error: 'Invalid video ID' });
        }

        // Get video from database
        const video = await db.get('SELECT * FROM videos WHERE id = ?', [videoIdNum]);
        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }

        // Extract video filename from URL
        const videoUrl = video.videoUrl;
        const videoFilename = require('path').basename(videoUrl);
        const videoPath = require('path').join(process.env.UPLOAD_PATH || './public/uploads', 'videos', videoFilename);

        // Create thumbnail filename
        const ext = require('path').extname(videoFilename);
        const name = require('path').basename(videoFilename, ext);
        const thumbnailFilename = `${name}_thumb.jpg`;
        const thumbnailPath = require('path').join(process.env.UPLOAD_PATH || './public/uploads', 'thumbnails', thumbnailFilename);

        const result = await videoCompressionService.generateThumbnail(videoPath, thumbnailPath, { timestamp });

        if (result.success) {
            // Update database with thumbnail path
            const thumbnailUrl = `/uploads/thumbnails/${thumbnailFilename}`;
            await db.run(
                'UPDATE videos SET thumbnailUrl = ? WHERE id = ?',
                [thumbnailUrl, videoIdNum]
            );

            res.json({
                success: true,
                thumbnail: {
                    ...result,
                    thumbnailUrl: thumbnailUrl
                }
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error,
                message: result.message
            });
        }
    } catch (error) {
        console.error('Thumbnail generation error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get compression statistics
router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
    try {
        // Get compression statistics from database
        const db = req.app.get('db');

        const stats = await db.get(`
            SELECT
                COUNT(*) as totalVideos,
                COUNT(CASE WHEN optimizedUrl IS NOT NULL THEN 1 END) as optimizedVideos,
                AVG(CASE WHEN optimizedUrl IS NOT NULL THEN 1 ELSE 0 END) * 100 as optimizationRate
            FROM videos
        `);

        res.json({
            success: true,
            statistics: stats || {}
        });
    } catch (error) {
        console.error('Compression stats error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;