const express = require('express');
const { Database } = require('../models/index');
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

// Get all tags
router.get('/', async (req, res) => {
    try {
        const db = await initDatabase();
        const tags = await db.all('SELECT * FROM tags ORDER BY name');
        res.json({ success: true, tags });
    } catch (error) {
        console.error('Get tags error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get tags for a specific video
router.get('/video/:videoId', async (req, res) => {
    try {
        const db = await initDatabase();
        const { videoId } = req.params;

        const tags = await db.all(`
            SELECT t.* FROM tags t
            INNER JOIN video_tags vt ON t.id = vt.tagId
            WHERE vt.videoId = ?
            ORDER BY t.name
        `, [videoId]);

        res.json({ success: true, tags });
    } catch (error) {
        console.error('Get video tags error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create new tag (admin only)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = await initDatabase();
        const { name, description, color } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Tag name is required' });
        }

        // Check if tag already exists
        const existingTag = await db.get('SELECT id FROM tags WHERE name = ?', [name]);
        if (existingTag) {
            return res.status(409).json({ error: 'Tag already exists' });
        }

        const result = await db.run(
            'INSERT INTO tags (name, description, color) VALUES (?, ?, ?)',
            [name, description || '', color || '#2563eb']
        );

        res.status(201).json({
            success: true,
            message: 'Tag created successfully',
            tagId: result.id
        });
    } catch (error) {
        console.error('Create tag error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update tag (admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = await initDatabase();
        const { id } = req.params;
        const { name, description, color } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Tag name is required' });
        }

        // Check if tag exists
        const existingTag = await db.get('SELECT id FROM tags WHERE id = ?', [id]);
        if (!existingTag) {
            return res.status(404).json({ error: 'Tag not found' });
        }

        // Check if name is already used by another tag
        const duplicateTag = await db.get('SELECT id FROM tags WHERE name = ? AND id != ?', [name, id]);
        if (duplicateTag) {
            return res.status(409).json({ error: 'Tag name already exists' });
        }

        await db.run(
            'UPDATE tags SET name = ?, description = ?, color = ? WHERE id = ?',
            [name, description || '', color || '#2563eb', id]
        );

        res.json({ success: true, message: 'Tag updated successfully' });
    } catch (error) {
        console.error('Update tag error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete tag (admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = await initDatabase();
        const { id } = req.params;

        // Check if tag exists
        const existingTag = await db.get('SELECT id FROM tags WHERE id = ?', [id]);
        if (!existingTag) {
            return res.status(404).json({ error: 'Tag not found' });
        }

        // Remove tag from all videos first
        await db.run('DELETE FROM video_tags WHERE tagId = ?', [id]);

        // Delete the tag
        await db.run('DELETE FROM tags WHERE id = ?', [id]);

        res.json({ success: true, message: 'Tag deleted successfully' });
    } catch (error) {
        console.error('Delete tag error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add tag to video
router.post('/video/:videoId', authenticateToken, async (req, res) => {
    try {
        const db = await initDatabase();
        const { videoId } = req.params;
        const { tagId } = req.body;

        if (!tagId) {
            return res.status(400).json({ error: 'Tag ID is required' });
        }

        // Check if video exists
        const video = await db.get('SELECT id FROM videos WHERE id = ?', [videoId]);
        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }

        // Check if tag exists
        const tag = await db.get('SELECT id FROM tags WHERE id = ?', [tagId]);
        if (!tag) {
            return res.status(404).json({ error: 'Tag not found' });
        }

        // Add tag to video (ignore if already exists)
        await db.run(
            'INSERT OR IGNORE INTO video_tags (videoId, tagId) VALUES (?, ?)',
            [videoId, tagId]
        );

        res.json({ success: true, message: 'Tag added to video successfully' });
    } catch (error) {
        console.error('Add video tag error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Remove tag from video
router.delete('/video/:videoId/:tagId', authenticateToken, async (req, res) => {
    try {
        const db = await initDatabase();
        const { videoId, tagId } = req.params;

        await db.run(
            'DELETE FROM video_tags WHERE videoId = ? AND tagId = ?',
            [videoId, tagId]
        );

        res.json({ success: true, message: 'Tag removed from video successfully' });
    } catch (error) {
        console.error('Remove video tag error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Search videos by tags
router.get('/search', async (req, res) => {
    try {
        const db = await initDatabase();
        const { tags } = req.query; // Comma-separated tag names or IDs

        if (!tags) {
            return res.status(400).json({ error: 'Tags parameter is required' });
        }

        const tagList = tags.split(',').map(tag => tag.trim());
        const placeholders = tagList.map(() => '?').join(',');

        // Search by tag names or IDs
        const videos = await db.all(`
            SELECT DISTINCT v.*, c.name as categoryName,
                   GROUP_CONCAT(t.name) as tagNames
            FROM videos v
            LEFT JOIN categories c ON v.categoryId = c.id
            INNER JOIN video_tags vt ON v.id = vt.videoId
            INNER JOIN tags t ON vt.tagId = t.id
            WHERE t.name IN (${placeholders}) OR t.id IN (${placeholders})
            GROUP BY v.id
            ORDER BY v.created_at DESC
        `, [...tagList, ...tagList]);

        res.json({ success: true, videos });
    } catch (error) {
        console.error('Search by tags error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;