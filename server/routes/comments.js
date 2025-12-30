const express = require('express');
const { Database, Comment, Log } = require('../models/index');
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

// Get comments for a video
router.get('/video/:videoId', async (req, res) => {
    try {
        const db = await initDatabase();
        const { videoId } = req.params;

        // Check if video exists
        const video = await db.get('SELECT * FROM videos WHERE id = ?', [videoId]);
        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }

        const comments = await Comment.getByVideoId(db, videoId);
        res.json({ success: true, comments });
    } catch (error) {
        console.error('Get comments error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create a new comment
router.post('/', authenticateToken, async (req, res) => {
    try {
        const db = await initDatabase();
        const { videoId, text } = req.body;

        if (!videoId || !text || text.trim().length === 0) {
            return res.status(400).json({ error: 'Video ID and comment text are required' });
        }

        // Check if video exists
        const video = await db.get('SELECT * FROM videos WHERE id = ?', [videoId]);
        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }

        const result = await Comment.create(db, {
            videoId,
            userId: req.user.username,
            text: text.trim()
        });

        await Log.create(db, req.user.username, 'Post Comment', `Posted comment on video ID: ${videoId}`);

        res.status(201).json({
            success: true,
            message: 'Comment posted successfully',
            commentId: result.id
        });
    } catch (error) {
        console.error('Create comment error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete a comment (admin only or comment owner)
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const db = await initDatabase();
        const { id } = req.params;

        // Get comment to check ownership
        const comment = await db.get('SELECT * FROM comments WHERE id = ?', [id]);
        if (!comment) {
            return res.status(404).json({ error: 'Comment not found' });
        }

        // Only admin or comment owner can delete
        if (req.user.role !== 'admin' && req.user.username !== comment.userId) {
            return res.status(403).json({ error: 'You can only delete your own comments' });
        }

        await Comment.delete(db, id);
        await Log.create(db, req.user.username, 'Delete Comment', `Deleted comment ID: ${id}`);

        res.json({ success: true, message: 'Comment deleted successfully' });
    } catch (error) {
        console.error('Delete comment error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;