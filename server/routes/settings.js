const express = require('express');
const { Database, Settings, Log } = require('../models/index');
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

// Get all settings
router.get('/', async (req, res) => {
    try {
        const db = await initDatabase();
        const settings = await Settings.getAll(db);

        // Convert to key-value object
        const settingsObject = {};
        settings.forEach(setting => {
            settingsObject[setting.key] = setting.value;
        });

        res.json({ success: true, settings: settingsObject });
    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get specific setting by key
router.get('/:key', async (req, res) => {
    try {
        const db = await initDatabase();
        const { key } = req.params;
        const setting = await Settings.get(db, key);

        if (!setting) {
            return res.status(404).json({ error: 'Setting not found' });
        }

        res.json({ success: true, key, value: setting.value });
    } catch (error) {
        console.error('Get setting error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update settings (admin only)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = await initDatabase();
        const settings = req.body;

        if (!settings || typeof settings !== 'object') {
            return res.status(400).json({ error: 'Settings object is required' });
        }

        // Update each setting
        const updatedSettings = [];
        for (const [key, value] of Object.entries(settings)) {
            if (typeof value === 'string' && value.trim().length > 0) {
                await Settings.set(db, key, value);
                updatedSettings.push(key);
            }
        }

        if (updatedSettings.length === 0) {
            return res.status(400).json({ error: 'No valid settings to update' });
        }

        await Log.create(db, req.user.username, 'Update Settings', `Updated settings: ${updatedSettings.join(', ')}`);

        res.json({
            success: true,
            message: 'Settings updated successfully',
            updatedSettings
        });
    } catch (error) {
        console.error('Update settings error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update specific setting (admin only)
router.put('/:key', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = await initDatabase();
        const { key } = req.params;
        const { value } = req.body;

        if (!value || value.trim().length === 0) {
            return res.status(400).json({ error: 'Value is required' });
        }

        await Settings.set(db, key, value);
        await Log.create(db, req.user.username, 'Update Setting', `Updated setting ${key}: ${value}`);

        res.json({
            success: true,
            message: 'Setting updated successfully',
            key,
            value
        });
    } catch (error) {
        console.error('Update setting error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;