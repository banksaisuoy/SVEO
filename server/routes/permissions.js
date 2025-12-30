const express = require('express');
const { Database, Permission, Log } = require('../models/index');
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

// ========================
// PERMISSIONS ROUTES
// ========================

// Get all permissions
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = await initDatabase();
        const permissions = await Permission.getAll(db);

        // Group by category
        const groupedPermissions = permissions.reduce((acc, permission) => {
            if (!acc[permission.category]) {
                acc[permission.category] = [];
            }
            acc[permission.category].push(permission);
            return acc;
        }, {});

        res.json({ success: true, permissions: groupedPermissions });
    } catch (error) {
        console.error('Get permissions error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get permissions by category
router.get('/category/:category', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = await initDatabase();
        const { category } = req.params;
        const permissions = await Permission.getByCategory(db, category);
        res.json({ success: true, permissions });
    } catch (error) {
        console.error('Get permissions by category error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get user permissions
router.get('/user/:username', authenticateToken, async (req, res) => {
    try {
        const db = await initDatabase();
        const { username } = req.params;

        // Users can only view their own permissions, admins can view any
        if (req.user.role !== 'admin' && req.user.username !== username) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const permissions = await Permission.getUserPermissions(db, username);

        // Group by category
        const groupedPermissions = permissions.reduce((acc, permission) => {
            if (!acc[permission.category]) {
                acc[permission.category] = [];
            }
            acc[permission.category].push(permission);
            return acc;
        }, {});

        res.json({ success: true, permissions: groupedPermissions });
    } catch (error) {
        console.error('Get user permissions error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Grant permission to user
router.post('/user/:username/:permissionId', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = await initDatabase();
        const { username, permissionId } = req.params;

        // Check if user exists
        const User = require('../models/index').User;
        const user = await User.findByUsername(db, username);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        await Permission.grantUserPermission(db, username, permissionId, req.user.username);
        await Log.create(db, req.user.username, 'Grant Permission', `Granted permission ${permissionId} to user: ${username}`);

        res.json({ success: true, message: 'Permission granted successfully' });
    } catch (error) {
        console.error('Grant user permission error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Revoke permission from user
router.delete('/user/:username/:permissionId', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = await initDatabase();
        const { username, permissionId } = req.params;

        await Permission.revokeUserPermission(db, username, permissionId);
        await Log.create(db, req.user.username, 'Revoke Permission', `Revoked permission ${permissionId} from user: ${username}`);

        res.json({ success: true, message: 'Permission revoked successfully' });
    } catch (error) {
        console.error('Revoke user permission error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Grant permission to group
router.post('/group/:groupId/:permissionId', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = await initDatabase();
        const { groupId, permissionId } = req.params;

        // Check if group exists
        const UserGroup = require('../models/index').UserGroup;
        const group = await UserGroup.getById(db, groupId);
        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }

        await Permission.grantGroupPermission(db, groupId, permissionId, req.user.username);
        await Log.create(db, req.user.username, 'Grant Group Permission', `Granted permission ${permissionId} to group: ${group.name}`);

        res.json({ success: true, message: 'Permission granted to group successfully' });
    } catch (error) {
        console.error('Grant group permission error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Revoke permission from group
router.delete('/group/:groupId/:permissionId', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = await initDatabase();
        const { groupId, permissionId } = req.params;

        const UserGroup = require('../models/index').UserGroup;
        const group = await UserGroup.getById(db, groupId);

        await Permission.revokeGroupPermission(db, groupId, permissionId);
        await Log.create(db, req.user.username, 'Revoke Group Permission', `Revoked permission ${permissionId} from group: ${group?.name || groupId}`);

        res.json({ success: true, message: 'Permission revoked from group successfully' });
    } catch (error) {
        console.error('Revoke group permission error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;