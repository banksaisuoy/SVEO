const express = require('express');
const { Database, UserGroup, Permission, PasswordPolicy, Log } = require('../models/index');
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

// Permission check middleware
function checkPermission(permission) {
    return async (req, res, next) => {
        try {
            const db = await initDatabase();
            const userPermissions = await Permission.getUserPermissions(db, req.user.username);

            const hasPermission = userPermissions.some(p => p.name === permission) || req.user.role === 'admin';

            if (!hasPermission) {
                return res.status(403).json({ error: `Permission required: ${permission}` });
            }

            next();
        } catch (error) {
            console.error('Permission check error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    };
}

// ========================
// USER GROUPS ROUTES
// ========================

// Get all groups
router.get('/', authenticateToken, checkPermission('group.view'), async (req, res) => {
    try {
        const db = await initDatabase();
        const groups = await UserGroup.getAll(db);
        res.json({ success: true, groups });
    } catch (error) {
        console.error('Get groups error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get single group by ID
router.get('/:id', authenticateToken, checkPermission('group.view'), async (req, res) => {
    try {
        const db = await initDatabase();
        const { id } = req.params;

        const group = await UserGroup.getById(db, id);
        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }

        const members = await UserGroup.getMembers(db, id);

        res.json({
            success: true,
            group: { ...group, members }
        });
    } catch (error) {
        console.error('Get group error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create new group
router.post('/', authenticateToken, checkPermission('group.create'), async (req, res) => {
    try {
        const db = await initDatabase();
        const { name, description, color } = req.body;

        if (!name || name.trim().length === 0) {
            return res.status(400).json({ error: 'Group name is required' });
        }

        const groupData = {
            name: name.trim(),
            description: description?.trim() || '',
            color: color || '#2a9d8f',
            created_by: req.user.username
        };

        const result = await UserGroup.create(db, groupData);
        await Log.create(db, req.user.username, 'Create Group', `Created group: ${name}`);

        res.status(201).json({
            success: true,
            message: 'Group created successfully',
            groupId: result.id
        });
    } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
            return res.status(409).json({ error: 'Group name already exists' });
        }
        console.error('Create group error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update group
router.put('/:id', authenticateToken, checkPermission('group.edit'), async (req, res) => {
    try {
        const db = await initDatabase();
        const { id } = req.params;
        const { name, description, color } = req.body;

        // Check if group exists
        const existingGroup = await UserGroup.getById(db, id);
        if (!existingGroup) {
            return res.status(404).json({ error: 'Group not found' });
        }

        if (!name || name.trim().length === 0) {
            return res.status(400).json({ error: 'Group name is required' });
        }

        const groupData = {
            name: name.trim(),
            description: description?.trim() || '',
            color: color || '#2a9d8f'
        };

        await UserGroup.update(db, id, groupData);
        await Log.create(db, req.user.username, 'Update Group', `Updated group: ${name}`);

        res.json({ success: true, message: 'Group updated successfully' });
    } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
            return res.status(409).json({ error: 'Group name already exists' });
        }
        console.error('Update group error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete group
router.delete('/:id', authenticateToken, checkPermission('group.delete'), async (req, res) => {
    try {
        const db = await initDatabase();
        const { id } = req.params;

        // Check if group exists
        const existingGroup = await UserGroup.getById(db, id);
        if (!existingGroup) {
            return res.status(404).json({ error: 'Group not found' });
        }

        await UserGroup.delete(db, id);
        await Log.create(db, req.user.username, 'Delete Group', `Deleted group: ${existingGroup.name}`);

        res.json({ success: true, message: 'Group deleted successfully' });
    } catch (error) {
        console.error('Delete group error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add member to group
router.post('/:id/members', authenticateToken, checkPermission('group.manage_members'), async (req, res) => {
    try {
        const db = await initDatabase();
        const { id } = req.params;
        const { username, role } = req.body;

        if (!username) {
            return res.status(400).json({ error: 'Username is required' });
        }

        // Check if group exists
        const group = await UserGroup.getById(db, id);
        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }

        // Check if user exists
        const User = require('../models/index').User;
        const user = await User.findByUsername(db, username);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        await UserGroup.addMember(db, id, username, role || 'member', req.user.username);
        await Log.create(db, req.user.username, 'Add Group Member', `Added ${username} to group: ${group.name}`);

        res.json({ success: true, message: 'Member added to group successfully' });
    } catch (error) {
        console.error('Add member error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Remove member from group
router.delete('/:id/members/:username', authenticateToken, checkPermission('group.manage_members'), async (req, res) => {
    try {
        const db = await initDatabase();
        const { id, username } = req.params;

        // Check if group exists
        const group = await UserGroup.getById(db, id);
        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }

        await UserGroup.removeMember(db, id, username);
        await Log.create(db, req.user.username, 'Remove Group Member', `Removed ${username} from group: ${group.name}`);

        res.json({ success: true, message: 'Member removed from group successfully' });
    } catch (error) {
        console.error('Remove member error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get user's groups
router.get('/user/:username', authenticateToken, async (req, res) => {
    try {
        const db = await initDatabase();
        const { username } = req.params;

        // Users can only view their own groups, admins can view any
        if (req.user.role !== 'admin' && req.user.username !== username) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const groups = await UserGroup.getUserGroups(db, username);
        res.json({ success: true, groups });
    } catch (error) {
        console.error('Get user groups error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;