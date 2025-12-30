const express = require('express');
const { Database, ReportReason, Log } = require('../models/index');
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

// Get all report reasons (public - for forms)
router.get('/', async (req, res) => {
    try {
        const db = await initDatabase();
        const reasons = await ReportReason.getAll(db);
        res.json({ success: true, reasons });
    } catch (error) {
        console.error('Get report reasons error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get single report reason by ID (admin only)
router.get('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = await initDatabase();
        const { id } = req.params;
        const reason = await ReportReason.getById(db, id);

        if (!reason) {
            return res.status(404).json({ error: 'Report reason not found' });
        }

        res.json({ success: true, reason });
    } catch (error) {
        console.error('Get report reason error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create new report reason (admin only)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = await initDatabase();
        const { reason } = req.body;

        if (!reason || reason.trim().length === 0) {
            return res.status(400).json({ error: 'Reason text is required' });
        }

        const result = await ReportReason.create(db, reason.trim());
        await Log.create(db, req.user.username, 'Add Report Reason', `Added new report reason: ${reason}`);

        res.status(201).json({
            success: true,
            message: 'Report reason created successfully',
            reasonId: result.id
        });
    } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
            return res.status(409).json({ error: 'Report reason already exists' });
        }
        console.error('Create report reason error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update report reason (admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = await initDatabase();
        const { id } = req.params;
        const { reason } = req.body;

        // Check if reason exists
        const existingReason = await ReportReason.getById(db, id);
        if (!existingReason) {
            return res.status(404).json({ error: 'Report reason not found' });
        }

        if (!reason || reason.trim().length === 0) {
            return res.status(400).json({ error: 'Reason text is required' });
        }

        await ReportReason.update(db, id, reason.trim());
        await Log.create(db, req.user.username, 'Update Report Reason', `Updated report reason ID: ${id}`);

        res.json({ success: true, message: 'Report reason updated successfully' });
    } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
            return res.status(409).json({ error: 'Report reason already exists' });
        }
        console.error('Update report reason error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete report reason (admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = await initDatabase();
        const { id } = req.params;

        // Check if reason exists
        const existingReason = await ReportReason.getById(db, id);
        if (!existingReason) {
            return res.status(404).json({ error: 'Report reason not found' });
        }

        // Soft delete (set is_active = 0)
        await ReportReason.delete(db, id);
        await Log.create(db, req.user.username, 'Delete Report Reason', `Deleted report reason ID: ${id}`);

        res.json({ success: true, message: 'Report reason deleted successfully' });
    } catch (error) {
        console.error('Delete report reason error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;