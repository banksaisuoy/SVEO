const express = require('express');
const { Database, AuditTrail } = require('../models/index');
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

// Get all audit trails (admin only)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = await initDatabase();
        const { limit } = req.query;

        const auditLimit = parseInt(limit) || 100;
        const auditTrails = await AuditTrail.getAll(db, auditLimit);

        res.json({ success: true, auditTrails });
    } catch (error) {
        console.error('Get audit trails error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get audit trails for specific user
router.get('/user/:userId', authenticateToken, async (req, res) => {
    try {
        const db = await initDatabase();
        const { userId } = req.params;
        const { limit } = req.query;

        // Users can only access their own audit trail unless admin
        if (req.user.role !== 'admin' && req.user.username !== userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const auditLimit = parseInt(limit) || 50;
        const auditTrails = await AuditTrail.getByUser(db, userId, auditLimit);

        res.json({ success: true, auditTrails });
    } catch (error) {
        console.error('Get user audit trails error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get audit trails for specific resource
router.get('/resource/:resourceType/:resourceId', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = await initDatabase();
        const { resourceType, resourceId } = req.params;
        const { limit } = req.query;

        const auditLimit = parseInt(limit) || 50;
        const auditTrails = await AuditTrail.getByResource(db, resourceType, resourceId, auditLimit);

        res.json({ success: true, auditTrails });
    } catch (error) {
        console.error('Get resource audit trails error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Search audit trails (admin only)
router.get('/search', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = await initDatabase();
        const {
            userId,
            action,
            resource_type,
            dateFrom,
            dateTo,
            limit
        } = req.query;

        const filters = {};
        if (userId) filters.userId = userId;
        if (action) filters.action = action;
        if (resource_type) filters.resource_type = resource_type;
        if (dateFrom) filters.dateFrom = dateFrom;
        if (dateTo) filters.dateTo = dateTo;

        const auditLimit = parseInt(limit) || 100;
        const auditTrails = await AuditTrail.search(db, filters, auditLimit);

        res.json({
            success: true,
            auditTrails,
            filters: filters
        });
    } catch (error) {
        console.error('Search audit trails error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create audit trail entry
router.post('/', authenticateToken, async (req, res) => {
    try {
        const db = await initDatabase();
        const {
            action,
            resource_type,
            resource_id,
            old_values,
            new_values
        } = req.body;

        if (!action || !resource_type) {
            return res.status(400).json({ error: 'Action and resource type are required' });
        }

        // Get IP address and user agent from request
        const ip_address = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
        const user_agent = req.headers['user-agent'];

        const auditData = {
            userId: req.user.username,
            action,
            resource_type,
            resource_id: resource_id || null,
            old_values: old_values ? JSON.stringify(old_values) : null,
            new_values: new_values ? JSON.stringify(new_values) : null,
            ip_address,
            user_agent
        };

        const result = await AuditTrail.create(db, auditData);

        res.status(201).json({
            success: true,
            message: 'Audit trail entry created successfully',
            auditId: result.id
        });
    } catch (error) {
        console.error('Create audit trail error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get audit trail statistics (admin only)
router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = await initDatabase();

        // Get total count
        const totalResult = await db.get('SELECT COUNT(*) as total FROM audit_trail');

        // Get count by action type
        const actionStats = await db.all(`
            SELECT action, COUNT(*) as count
            FROM audit_trail
            GROUP BY action
            ORDER BY count DESC
        `);

        // Get count by resource type
        const resourceStats = await db.all(`
            SELECT resource_type, COUNT(*) as count
            FROM audit_trail
            GROUP BY resource_type
            ORDER BY count DESC
        `);

        // Get most active users
        const userStats = await db.all(`
            SELECT at.userId, u.username, COUNT(*) as action_count
            FROM audit_trail at
            LEFT JOIN users u ON at.userId = u.username
            GROUP BY at.userId
            ORDER BY action_count DESC
            LIMIT 10
        `);

        // Get recent activity (last 24 hours)
        const recentActivity = await db.get(`
            SELECT COUNT(*) as recent_count
            FROM audit_trail
            WHERE created_at >= datetime('now', '-1 day')
        `);

        res.json({
            success: true,
            stats: {
                total: totalResult.total,
                recentActivity: recentActivity.recent_count,
                actionBreakdown: actionStats,
                resourceBreakdown: resourceStats,
                topUsers: userStats
            }
        });
    } catch (error) {
        console.error('Get audit trail stats error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get audit trail export (admin only)
router.get('/export', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = await initDatabase();
        const {
            format = 'json',
            dateFrom,
            dateTo,
            userId,
            action,
            resource_type,
            limit = 1000
        } = req.query;

        const filters = {};
        if (userId) filters.userId = userId;
        if (action) filters.action = action;
        if (resource_type) filters.resource_type = resource_type;
        if (dateFrom) filters.dateFrom = dateFrom;
        if (dateTo) filters.dateTo = dateTo;

        const auditLimit = parseInt(limit);
        const auditTrails = await AuditTrail.search(db, filters, auditLimit);

        if (format === 'csv') {
            // Generate CSV format
            const csvHeader = 'Timestamp,User,Action,Resource Type,Resource ID,IP Address,User Agent\n';
            const csvData = auditTrails.map(audit => {
                return [
                    audit.created_at,
                    audit.user_name || audit.userId,
                    audit.action,
                    audit.resource_type,
                    audit.resource_id || '',
                    audit.ip_address || '',
                    audit.user_agent || ''
                ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
            }).join('\n');

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="audit_trail_${new Date().toISOString().split('T')[0]}.csv"`);
            res.send(csvHeader + csvData);
        } else {
            // JSON format (default)
            res.json({
                success: true,
                auditTrails,
                exportInfo: {
                    generatedAt: new Date().toISOString(),
                    filters,
                    totalRecords: auditTrails.length,
                    format
                }
            });
        }
    } catch (error) {
        console.error('Export audit trail error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;