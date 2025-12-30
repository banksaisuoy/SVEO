const express = require('express');
const { Database, Favorite, Log } = require('../models/index');
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

// Get user's favorite videos
router.get('/', authenticateToken, async (req, res) => {
    try {
        const db = await initDatabase();
        const favorites = await Favorite.getUserFavorites(db, req.user.username);
        res.json({ success: true, favorites });
    } catch (error) {
        console.error('Get favorites error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Check if video is favorited by user
router.get('/:videoId', authenticateToken, async (req, res) => {
    try {
        const db = await initDatabase();
        const { videoId } = req.params;
        const isFavorited = await Favorite.isFavorited(db, req.user.username, videoId);
        res.json({ success: true, isFavorited });
    } catch (error) {
        console.error('Check favorite error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add video to favorites
router.post('/:videoId', authenticateToken, async (req, res) => {
    try {
        const db = await initDatabase();
        const { videoId } = req.params;

        // Check if video exists
        const video = await db.get('SELECT * FROM videos WHERE id = ?', [videoId]);
        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }

        // Check if already favorited
        const isFavorited = await Favorite.isFavorited(db, req.user.username, videoId);
        if (isFavorited) {
            return res.status(409).json({ error: 'Video already in favorites' });
        }

        await Favorite.add(db, req.user.username, videoId);
        await Log.create(db, req.user.username, 'Add Favorite', `Added video ID ${videoId} to favorites`);

        res.json({ success: true, message: 'Video added to favorites' });
    } catch (error) {
        console.error('Add favorite error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Remove video from favorites
router.delete('/:videoId', authenticateToken, async (req, res) => {
    try {
        const db = await initDatabase();
        const { videoId } = req.params;

        // Check if favorited
        const isFavorited = await Favorite.isFavorited(db, req.user.username, videoId);
        if (!isFavorited) {
            return res.status(404).json({ error: 'Video not in favorites' });
        }

        await Favorite.remove(db, req.user.username, videoId);
        await Log.create(db, req.user.username, 'Remove Favorite', `Removed video ID ${videoId} from favorites`);

        res.json({ success: true, message: 'Video removed from favorites' });
    } catch (error) {
        console.error('Remove favorite error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;