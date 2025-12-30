const express = require('express');
const { Database, Playlist } = require('../models/index');
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

// Get user's playlists
router.get('/user/:userId', authenticateToken, async (req, res) => {
    try {
        const db = await initDatabase();
        const { userId } = req.params;

        // Users can only access their own playlists unless admin
        if (req.user.role !== 'admin' && req.user.username !== userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const playlists = await Playlist.getUserPlaylists(db, userId);
        res.json({ success: true, playlists });
    } catch (error) {
        console.error('Get user playlists error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get current user's playlists
router.get('/my', authenticateToken, async (req, res) => {
    try {
        const db = await initDatabase();
        const playlists = await Playlist.getUserPlaylists(db, req.user.username);
        res.json({ success: true, playlists });
    } catch (error) {
        console.error('Get my playlists error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get playlist by ID
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const db = await initDatabase();
        const { id } = req.params;

        const playlist = await Playlist.getById(db, id);
        if (!playlist) {
            return res.status(404).json({ error: 'Playlist not found' });
        }

        // Check access permissions
        if (req.user.role !== 'admin' && req.user.username !== playlist.userId && !playlist.is_public) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json({ success: true, playlist });
    } catch (error) {
        console.error('Get playlist error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get playlist videos
router.get('/:id/videos', authenticateToken, async (req, res) => {
    try {
        const db = await initDatabase();
        const { id } = req.params;

        const playlist = await Playlist.getById(db, id);
        if (!playlist) {
            return res.status(404).json({ error: 'Playlist not found' });
        }

        // Check access permissions
        if (req.user.role !== 'admin' && req.user.username !== playlist.userId && !playlist.is_public) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const videos = await Playlist.getVideos(db, id);
        res.json({ success: true, videos });
    } catch (error) {
        console.error('Get playlist videos error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create new playlist
router.post('/', authenticateToken, async (req, res) => {
    try {
        const db = await initDatabase();
        const { name, description, is_public } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Playlist name is required' });
        }

        const playlistData = {
            name,
            description: description || '',
            userId: req.user.username,
            is_public: is_public || false
        };

        const result = await Playlist.create(db, playlistData);

        res.status(201).json({
            success: true,
            message: 'Playlist created successfully',
            playlistId: result.id
        });
    } catch (error) {
        console.error('Create playlist error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update playlist
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const db = await initDatabase();
        const { id } = req.params;
        const { name, description, is_public } = req.body;

        const playlist = await Playlist.getById(db, id);
        if (!playlist) {
            return res.status(404).json({ error: 'Playlist not found' });
        }

        // Only owner or admin can update
        if (req.user.role !== 'admin' && req.user.username !== playlist.userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (!name) {
            return res.status(400).json({ error: 'Playlist name is required' });
        }

        const playlistData = {
            name,
            description: description || '',
            is_public: is_public || false
        };

        await Playlist.update(db, id, playlistData);

        res.json({ success: true, message: 'Playlist updated successfully' });
    } catch (error) {
        console.error('Update playlist error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete playlist
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const db = await initDatabase();
        const { id } = req.params;

        const playlist = await Playlist.getById(db, id);
        if (!playlist) {
            return res.status(404).json({ error: 'Playlist not found' });
        }

        // Only owner or admin can delete
        if (req.user.role !== 'admin' && req.user.username !== playlist.userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        await Playlist.delete(db, id);

        res.json({ success: true, message: 'Playlist deleted successfully' });
    } catch (error) {
        console.error('Delete playlist error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add video to playlist
router.post('/:id/videos', authenticateToken, async (req, res) => {
    try {
        const db = await initDatabase();
        const { id } = req.params;
        const { videoId, position } = req.body;

        if (!videoId) {
            return res.status(400).json({ error: 'Video ID is required' });
        }

        const playlist = await Playlist.getById(db, id);
        if (!playlist) {
            return res.status(404).json({ error: 'Playlist not found' });
        }

        // Only owner or admin can add videos
        if (req.user.role !== 'admin' && req.user.username !== playlist.userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Check if video exists
        const video = await db.get('SELECT id FROM videos WHERE id = ?', [videoId]);
        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }

        await Playlist.addVideo(db, id, videoId, position);

        res.json({ success: true, message: 'Video added to playlist successfully' });
    } catch (error) {
        console.error('Add video to playlist error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Remove video from playlist
router.delete('/:id/videos/:videoId', authenticateToken, async (req, res) => {
    try {
        const db = await initDatabase();
        const { id, videoId } = req.params;

        const playlist = await Playlist.getById(db, id);
        if (!playlist) {
            return res.status(404).json({ error: 'Playlist not found' });
        }

        // Only owner or admin can remove videos
        if (req.user.role !== 'admin' && req.user.username !== playlist.userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        await Playlist.removeVideo(db, id, videoId);

        res.json({ success: true, message: 'Video removed from playlist successfully' });
    } catch (error) {
        console.error('Remove video from playlist error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Reorder videos in playlist
router.put('/:id/videos/reorder', authenticateToken, async (req, res) => {
    try {
        const db = await initDatabase();
        const { id } = req.params;
        const { videoOrders } = req.body; // Array of {videoId, position}

        if (!Array.isArray(videoOrders)) {
            return res.status(400).json({ error: 'videoOrders must be an array' });
        }

        const playlist = await Playlist.getById(db, id);
        if (!playlist) {
            return res.status(404).json({ error: 'Playlist not found' });
        }

        // Only owner or admin can reorder videos
        if (req.user.role !== 'admin' && req.user.username !== playlist.userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        await Playlist.reorderVideos(db, id, videoOrders);

        res.json({ success: true, message: 'Playlist videos reordered successfully' });
    } catch (error) {
        console.error('Reorder playlist videos error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;