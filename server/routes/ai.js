const express = require('express');
const aiService = require('../services/aiService');
const { Video, Tag } = require('../models/index');
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

// Get AI service status
router.get('/status', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const status = await aiService.getStatus();
        res.json({
            success: true,
            ai: status
        });
    } catch (error) {
        console.error('AI status error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Categorize a video
router.post('/categorize', authenticateToken, requireAdmin, async (req, res) => {
    try {
        // Check if AI service is initialized
        if (!aiService.initialized) {
            return res.status(503).json({
                success: false,
                error: 'AI service not available - API key may be invalid or missing'
            });
        }

        const { videoId, title, description } = req.body;

        if (!videoId && (!title || !description)) {
            return res.status(400).json({ error: 'Video ID or title/description required' });
        }

        // Check if database is available
        const db = req.app.get('db');
        if (!db) {
            return res.status(500).json({ error: 'Database not available' });
        }

        let videoData;
        if (videoId) {
            // Get video from database
            videoData = await Video.getById(db, videoId);
            if (!videoData) {
                return res.status(404).json({ error: 'Video not found' });
            }
        } else {
            videoData = { title, description };
        }

        const result = await aiService.categorizeVideo(videoData);

        // Return success: true only if the AI operation was successful
        if (result.success) {
            res.json({
                success: true,
                categorization: result
            });
        } else {
            res.json({
                success: false,
                error: result.error || 'AI service failed',
                categorization: result
            });
        }
    } catch (error) {
        console.error('AI categorization error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Generate tags for a video
router.post('/tags', authenticateToken, requireAdmin, async (req, res) => {
    try {
        // Check if AI service is initialized
        if (!aiService.initialized) {
            return res.status(503).json({
                success: false,
                error: 'AI service not available - API key may be invalid or missing'
            });
        }

        const { videoId, title, description } = req.body;

        if (!videoId && (!title || !description)) {
            return res.status(400).json({ error: 'Video ID or title/description required' });
        }

        // Check if database is available
        const db = req.app.get('db');
        if (!db) {
            return res.status(500).json({ error: 'Database not available' });
        }

        let videoData;
        if (videoId) {
            videoData = await Video.getById(db, videoId);
            if (!videoData) {
                return res.status(404).json({ error: 'Video not found' });
            }
        } else {
            videoData = { title, description };
        }

        const result = await aiService.generateTags(videoData);

        // Return success: true only if the AI operation was successful
        if (result.success) {
            res.json({
                success: true,
                tags: result
            });
        } else {
            res.json({
                success: false,
                error: result.error || 'AI service failed',
                tags: result
            });
        }
    } catch (error) {
        console.error('AI tag generation error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Analyze video content
router.post('/analyze', authenticateToken, requireAdmin, async (req, res) => {
    try {
        // Check if AI service is initialized
        if (!aiService.initialized) {
            return res.status(503).json({
                success: false,
                error: 'AI service not available - API key may be invalid or missing'
            });
        }

        const { videoId, title, description } = req.body;

        if (!videoId && (!title || !description)) {
            return res.status(400).json({ error: 'Video ID or title/description required' });
        }

        // Check if database is available
        const db = req.app.get('db');
        if (!db) {
            return res.status(500).json({ error: 'Database not available' });
        }

        let videoData;
        if (videoId) {
            videoData = await Video.getById(db, videoId);
            if (!videoData) {
                return res.status(404).json({ error: 'Video not found' });
            }
        } else {
            videoData = { title, description };
        }

        const result = await aiService.analyzeContent(videoData);

        // Return success: true only if the AI operation was successful
        if (result.success) {
            res.json({
                success: true,
                analysis: result
            });
        } else {
            res.json({
                success: false,
                error: result.error || 'AI service failed',
                analysis: result
            });
        }
    } catch (error) {
        console.error('AI content analysis error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Generate summary for a video
router.post('/summary', authenticateToken, requireAdmin, async (req, res) => {
    try {
        // Check if AI service is initialized
        if (!aiService.initialized) {
            return res.status(503).json({
                success: false,
                error: 'AI service not available - API key may be invalid or missing'
            });
        }

        const { videoId, title, description } = req.body;

        if (!videoId && (!title || !description)) {
            return res.status(400).json({ error: 'Video ID or title/description required' });
        }

        // Check if database is available
        const db = req.app.get('db');
        if (!db) {
            return res.status(500).json({ error: 'Database not available' });
        }

        let videoData;
        if (videoId) {
            videoData = await Video.getById(db, videoId);
            if (!videoData) {
                return res.status(404).json({ error: 'Video not found' });
            }
        } else {
            videoData = { title, description };
        }

        const result = await aiService.generateSummary(videoData);

        // Return success: true only if the AI operation was successful
        if (result.success) {
            res.json({
                success: true,
                summary: result
            });
        } else {
            res.json({
                success: false,
                error: result.error || 'AI service failed',
                summary: result
            });
        }
    } catch (error) {
        console.error('AI summary generation error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Generate SEO metadata
router.post('/metadata', authenticateToken, requireAdmin, async (req, res) => {
    try {
        // Check if AI service is initialized
        if (!aiService.initialized) {
            return res.status(503).json({
                success: false,
                error: 'AI service not available - API key may be invalid or missing'
            });
        }

        const { videoId, title, description } = req.body;

        if (!videoId && (!title || !description)) {
            return res.status(400).json({ error: 'Video ID or title/description required' });
        }

        // Check if database is available
        const db = req.app.get('db');
        if (!db) {
            return res.status(500).json({ error: 'Database not available' });
        }

        let videoData;
        if (videoId) {
            videoData = await Video.getById(db, videoId);
            if (!videoData) {
                return res.status(404).json({ error: 'Video not found' });
            }
        } else {
            videoData = { title, description };
        }

        const result = await aiService.generateMetadata(videoData);

        // Return success: true only if the AI operation was successful
        if (result.success) {
            res.json({
                success: true,
                metadata: result
            });
        } else {
            res.json({
                success: false,
                error: result.error || 'AI service failed',
                metadata: result
            });
        }
    } catch (error) {
        console.error('AI metadata generation error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Batch process videos
router.post('/batch', authenticateToken, requireAdmin, async (req, res) => {
    try {
        // Check if AI service is initialized
        if (!aiService.initialized) {
            return res.status(503).json({
                success: false,
                error: 'AI service not available - API key may be invalid or missing'
            });
        }

        const { videoIds, operations } = req.body;

        if (!videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
            return res.status(400).json({ error: 'Video IDs required' });
        }

        // Check if database is available
        const db = req.app.get('db');
        if (!db) {
            return res.status(500).json({ error: 'Database not available' });
        }

        // Get videos from database
        const videos = [];
        for (const videoId of videoIds) {
            const video = await Video.getById(db, videoId);
            if (video) {
                videos.push(video);
            }
        }

        if (videos.length === 0) {
            return res.status(404).json({ error: 'No valid videos found' });
        }

        const result = await aiService.batchProcess(videos, operations);

        // Return success: true only if the AI operation was successful
        if (result.success) {
            res.json({
                success: true,
                processedCount: result.processedCount,
                results: result.results
            });
        } else {
            res.json({
                success: false,
                error: result.error || 'AI service failed',
                processedCount: result.processedCount,
                results: result.results
            });
        }
    } catch (error) {
        console.error('AI batch processing error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Auto-apply AI categorization to a video
router.post('/auto-categorize/:videoId', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { videoId } = req.params;

        // Check if database is available
        const db = req.app.get('db');
        if (!db) {
            return res.status(500).json({ error: 'Database not available' });
        }

        const video = await Video.getById(db, videoId);
        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }

        const categorization = await aiService.categorizeVideo(video);

        if (categorization.success) {
            // Try to find matching category in database
            const categories = await db.all('SELECT * FROM categories');
            const matchingCategory = categories.find(cat =>
                cat.name.toLowerCase() === categorization.category.toLowerCase()
            );

            if (matchingCategory) {
                // Update video category
                await Video.update(db, videoId, {
                    ...video,
                    categoryId: matchingCategory.id
                });

                res.json({
                    success: true,
                    message: 'Video category updated successfully',
                    categorization: categorization,
                    appliedCategory: matchingCategory
                });
            } else {
                res.json({
                    success: true,
                    message: 'Category suggested but not applied (category not found)',
                    categorization: categorization,
                    suggestedCategory: categorization.category
                });
            }
        } else {
            res.json({
                success: false,
                error: 'Failed to categorize video',
                details: categorization
            });
        }
    } catch (error) {
        console.error('Auto-categorization error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Auto-apply AI tags to a video
router.post('/auto-tag/:videoId', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { videoId } = req.params;

        // Check if database is available
        const db = req.app.get('db');
        if (!db) {
            return res.status(500).json({ error: 'Database not available' });
        }

        const video = await Video.getById(db, videoId);
        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }

        const tagging = await aiService.generateTags(video);

        if (tagging.success && tagging.tags.length > 0) {
            const appliedTags = [];

            // Create or find tags and apply them to the video
            for (const tagName of tagging.tags) {
                try {
                    // Try to find existing tag
                    let tag = await db.get('SELECT * FROM tags WHERE name = ?', [tagName]);

                    if (!tag) {
                        // Create new tag
                        const result = await Tag.create(db, { name: tagName });
                        tag = { id: result.id, name: tagName };
                    }

                    // Add tag to video
                    await Tag.addToVideo(db, videoId, tag.id);
                    appliedTags.push(tag);
                } catch (tagError) {
                    console.error('Error applying tag:', tagName, tagError);
                }
            }

            res.json({
                success: true,
                message: `Applied ${appliedTags.length} tags to video`,
                tagging: tagging,
                appliedTags: appliedTags
            });
        } else {
            res.json({
                success: false,
                error: 'Failed to generate tags',
                details: tagging
            });
        }
    } catch (error) {
        console.error('Auto-tagging error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;