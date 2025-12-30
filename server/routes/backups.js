const express = require('express');
const backupService = require('../services/backupService');
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

// Get backup service status
router.get('/status', authenticateToken, requireAdmin, (req, res) => {
    try {
        const status = backupService.getStatus();
        res.json({
            success: true,
            backup: status
        });
    } catch (error) {
        console.error('Backup status error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create database backup
router.post('/database', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const result = await backupService.backupDatabase();

        if (result.success) {
            res.json({
                success: true,
                backup: result
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error,
                message: result.message
            });
        }
    } catch (error) {
        console.error('Database backup error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create file backup
router.post('/files', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const result = await backupService.backupFiles();

        if (result.success) {
            res.json({
                success: true,
                backup: result
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error,
                message: result.message
            });
        }
    } catch (error) {
        console.error('File backup error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create full backup
router.post('/full', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const result = await backupService.backupFull();

        if (result.success) {
            res.json({
                success: true,
                backup: result
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error,
                message: result.message
            });
        }
    } catch (error) {
        console.error('Full backup error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// List all backups
router.get('/list', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const result = await backupService.listBackups();

        if (result.success) {
            res.json({
                success: true,
                backups: result
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error,
                message: result.message
            });
        }
    } catch (error) {
        console.error('List backups error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Restore database backup
router.post('/restore/:filename', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { filename } = req.params;

        // Validate filename
        if (!filename) {
            return res.status(400).json({ error: 'Backup filename required' });
        }

        const result = await backupService.restoreDatabase(filename);

        if (result.success) {
            res.json({
                success: true,
                restore: result
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error,
                message: result.message
            });
        }
    } catch (error) {
        console.error('Restore backup error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete backup
router.delete('/:filename', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { filename } = req.params;

        // Validate filename
        if (!filename) {
            return res.status(400).json({ error: 'Backup filename required' });
        }

        const result = await backupService.deleteBackup(filename);

        if (result.success) {
            res.json({
                success: true,
                delete: result
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error,
                message: result.message
            });
        }
    } catch (error) {
        console.error('Delete backup error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Schedule backups
router.post('/schedule', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const result = await backupService.scheduleBackups();

        if (result.success) {
            res.json({
                success: true,
                schedule: result
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error,
                message: result.message
            });
        }
    } catch (error) {
        console.error('Schedule backups error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;