const express = require('express');
const { Database, ContentSchedule, Video } = require('../models/index');
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

// Get all scheduled content (admin only)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = await initDatabase();
        const { status } = req.query;

        let schedules;
        if (status === 'pending') {
            schedules = await ContentSchedule.getPending(db);
        } else {
            schedules = await ContentSchedule.getAll(db);
        }

        res.json({ success: true, schedules });
    } catch (error) {
        console.error('Get scheduled content error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create new scheduled content
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = await initDatabase();
        const { videoId, publish_at, action_type, description } = req.body;

        if (!videoId || !publish_at) {
            return res.status(400).json({ error: 'Video ID and publish time are required' });
        }

        // Validate publish_at is a future date
        const publishDate = new Date(publish_at);
        if (publishDate <= new Date()) {
            return res.status(400).json({ error: 'Publish time must be in the future' });
        }

        // Check if video exists
        const video = await Video.getById(db, videoId);
        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }

        // Validate action_type
        const validActions = ['publish', 'unpublish', 'feature', 'unfeature'];
        if (action_type && !validActions.includes(action_type)) {
            return res.status(400).json({ error: 'Invalid action type' });
        }

        const scheduleData = {
            videoId,
            publish_at,
            action_type: action_type || 'publish',
            scheduled_by: req.user.username,
            description: description || ''
        };

        const result = await ContentSchedule.create(db, scheduleData);

        res.status(201).json({
            success: true,
            message: 'Content scheduled successfully',
            scheduleId: result.id
        });
    } catch (error) {
        console.error('Create scheduled content error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update scheduled content
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = await initDatabase();
        const { id } = req.params;
        const { publish_at, action_type, description, status } = req.body;

        // Check if schedule exists
        const existingSchedule = await db.get('SELECT * FROM content_schedule WHERE id = ?', [id]);
        if (!existingSchedule) {
            return res.status(404).json({ error: 'Scheduled content not found' });
        }

        // Validate publish_at if provided
        if (publish_at) {
            const publishDate = new Date(publish_at);
            if (publishDate <= new Date()) {
                return res.status(400).json({ error: 'Publish time must be in the future' });
            }
        }

        // Validate action_type if provided
        const validActions = ['publish', 'unpublish', 'feature', 'unfeature'];
        if (action_type && !validActions.includes(action_type)) {
            return res.status(400).json({ error: 'Invalid action type' });
        }

        // Validate status if provided
        const validStatuses = ['pending', 'executed', 'cancelled'];
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const scheduleData = {
            publish_at: publish_at || existingSchedule.publish_at,
            action_type: action_type || existingSchedule.action_type,
            description: description !== undefined ? description : existingSchedule.description,
            status: status || existingSchedule.status
        };

        await ContentSchedule.update(db, id, scheduleData);

        res.json({ success: true, message: 'Scheduled content updated successfully' });
    } catch (error) {
        console.error('Update scheduled content error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Execute scheduled content manually
router.post('/:id/execute', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = await initDatabase();
        const { id } = req.params;

        // Get the schedule
        const schedule = await db.get(`
            SELECT cs.*, v.title as videoTitle
            FROM content_schedule cs
            LEFT JOIN videos v ON cs.videoId = v.id
            WHERE cs.id = ?
        `, [id]);

        if (!schedule) {
            return res.status(404).json({ error: 'Scheduled content not found' });
        }

        if (schedule.status !== 'pending') {
            return res.status(400).json({ error: 'Only pending schedules can be executed' });
        }

        // Execute the action based on action_type
        try {
            switch (schedule.action_type) {
                case 'publish':
                    // Make video visible/featured
                    await db.run('UPDATE videos SET isFeatured = 1 WHERE id = ?', [schedule.videoId]);
                    break;
                case 'unpublish':
                    // Make video not featured
                    await db.run('UPDATE videos SET isFeatured = 0 WHERE id = ?', [schedule.videoId]);
                    break;
                case 'feature':
                    await db.run('UPDATE videos SET isFeatured = 1 WHERE id = ?', [schedule.videoId]);
                    break;
                case 'unfeature':
                    await db.run('UPDATE videos SET isFeatured = 0 WHERE id = ?', [schedule.videoId]);
                    break;
            }

            // Mark schedule as executed
            await ContentSchedule.execute(db, id);

            res.json({
                success: true,
                message: `Content ${schedule.action_type} executed successfully`
            });
        } catch (actionError) {
            console.error('Error executing scheduled action:', actionError);
            res.status(500).json({ error: 'Failed to execute scheduled action' });
        }
    } catch (error) {
        console.error('Execute scheduled content error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Cancel scheduled content
router.post('/:id/cancel', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = await initDatabase();
        const { id } = req.params;

        // Check if schedule exists and is pending
        const schedule = await db.get('SELECT * FROM content_schedule WHERE id = ?', [id]);
        if (!schedule) {
            return res.status(404).json({ error: 'Scheduled content not found' });
        }

        if (schedule.status !== 'pending') {
            return res.status(400).json({ error: 'Only pending schedules can be cancelled' });
        }

        await ContentSchedule.cancel(db, id);

        res.json({ success: true, message: 'Scheduled content cancelled successfully' });
    } catch (error) {
        console.error('Cancel scheduled content error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get pending schedules ready for execution
router.get('/pending', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = await initDatabase();
        const pendingSchedules = await ContentSchedule.getPending(db);

        res.json({ success: true, schedules: pendingSchedules });
    } catch (error) {
        console.error('Get pending schedules error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Batch execute pending schedules (for automated scheduler)
router.post('/execute-pending', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = await initDatabase();
        const pendingSchedules = await ContentSchedule.getPending(db);

        const results = [];

        for (const schedule of pendingSchedules) {
            try {
                // Execute the action based on action_type
                switch (schedule.action_type) {
                    case 'publish':
                        await db.run('UPDATE videos SET isFeatured = 1 WHERE id = ?', [schedule.videoId]);
                        break;
                    case 'unpublish':
                        await db.run('UPDATE videos SET isFeatured = 0 WHERE id = ?', [schedule.videoId]);
                        break;
                    case 'feature':
                        await db.run('UPDATE videos SET isFeatured = 1 WHERE id = ?', [schedule.videoId]);
                        break;
                    case 'unfeature':
                        await db.run('UPDATE videos SET isFeatured = 0 WHERE id = ?', [schedule.videoId]);
                        break;
                }

                // Mark schedule as executed
                await ContentSchedule.execute(db, schedule.id);

                results.push({
                    scheduleId: schedule.id,
                    videoId: schedule.videoId,
                    action: schedule.action_type,
                    success: true
                });
            } catch (actionError) {
                console.error(`Error executing schedule ${schedule.id}:`, actionError);
                results.push({
                    scheduleId: schedule.id,
                    videoId: schedule.videoId,
                    action: schedule.action_type,
                    success: false,
                    error: actionError.message
                });
            }
        }

        res.json({
            success: true,
            message: `Executed ${results.filter(r => r.success).length} of ${results.length} pending schedules`,
            results
        });
    } catch (error) {
        console.error('Batch execute pending schedules error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;