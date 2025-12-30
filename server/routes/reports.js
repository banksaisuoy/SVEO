const express = require('express');
const { Database, Report, Log } = require('../models/index');
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

// Get all reports (admin only)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = await initDatabase();
        const reports = await Report.getAll(db);
        res.json({ success: true, reports });
    } catch (error) {
        console.error('Get reports error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create a new report
router.post('/', authenticateToken, async (req, res) => {
    try {
        const db = await initDatabase();
        const { videoId, reason, customReason } = req.body;

        if (!videoId || !reason || reason.trim().length === 0) {
            return res.status(400).json({ error: 'Video ID and reason are required' });
        }

        // Check if video exists
        const video = await db.get('SELECT * FROM videos WHERE id = ?', [videoId]);
        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }

        // Check if user already reported this video
        const existingReport = await db.get(
            'SELECT * FROM reports WHERE userId = ? AND videoId = ?',
            [req.user.username, videoId]
        );

        if (existingReport) {
            return res.status(409).json({ error: 'You have already reported this video' });
        }

        // Insert report with custom reason if provided
        const result = await db.run(
            'INSERT INTO reports (userId, videoId, reason, custom_reason) VALUES (?, ?, ?, ?)',
            [req.user.username, videoId, reason.trim(), customReason ? customReason.trim() : null]
        );

        await Log.create(db, req.user.username, 'Report Video',
            `Reported video ID: ${videoId}, Reason: ${reason.trim()}${customReason ? `, Custom: ${customReason.trim()}` : ''}`
        );

        res.status(201).json({
            success: true,
            message: 'Report submitted successfully',
            reportId: result.id
        });
    } catch (error) {
        console.error('Create report error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Resolve/delete a report (admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = await initDatabase();
        const { id } = req.params;

        // Check if report exists
        const report = await db.get('SELECT * FROM reports WHERE id = ?', [id]);
        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }

        await Report.delete(db, id);
        await Log.create(db, req.user.username, 'Resolve Report', `Resolved report ID: ${id}`);

        res.json({ success: true, message: 'Report resolved successfully' });
    } catch (error) {
        console.error('Resolve report error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;