const express = require('express');
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

// Get activity logs (admin only)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = await initDatabase();
        const limit = parseInt(req.query.limit) || 100;
        const logs = await Log.getRecent(db, limit);
        res.json({ success: true, logs });
    } catch (error) {
        console.error('Get logs error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create a log entry (for manual logging if needed)
router.post('/', authenticateToken, async (req, res) => {
    try {
        const db = await initDatabase();
        const { action, details } = req.body;

        if (!action || action.trim().length === 0) {
            return res.status(400).json({ error: 'Action is required' });
        }

        const result = await Log.create(db, req.user.username, action.trim(), details || '');

        res.status(201).json({
            success: true,
            message: 'Log entry created successfully',
            logId: result.id
        });
    } catch (error) {
        console.error('Create log error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;