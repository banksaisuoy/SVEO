const express = require('express');
const { Database, User, Log } = require('../models/index');
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

// Get all users (admin only)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = await initDatabase();
        const users = await User.getAll(db);
        res.json({ success: true, users });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get single user by username (admin only or own profile)
router.get('/:username', authenticateToken, async (req, res) => {
    try {
        const db = await initDatabase();
        const { username } = req.params;

        // Users can only access their own profile, admins can access any
        if (req.user.role !== 'admin' && req.user.username !== username) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const user = await User.findByUsername(db, username);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Remove password from response
        const { password, ...userWithoutPassword } = user;
        res.json({ success: true, user: userWithoutPassword });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create new user (admin only)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = await initDatabase();
        const { username, password, role } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        if (username.length < 3) {
            return res.status(400).json({ error: 'Username must be at least 3 characters long' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters long' });
        }

        if (role && !['user', 'admin'].includes(role)) {
            return res.status(400).json({ error: 'Role must be either "user" or "admin"' });
        }

        await User.create(db, { username, password, role: role || 'user' });
        await Log.create(db, req.user.username, 'Add User', `Added new user: ${username}`);

        res.status(201).json({
            success: true,
            message: 'User created successfully'
        });
    } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
            return res.status(409).json({ error: 'Username already exists' });
        }
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update user (admin only or own profile)
router.put('/:username', authenticateToken, async (req, res) => {
    try {
        const db = await initDatabase();
        const { username } = req.params;
        const { password, role, fullName, department, employeeId, email, phone } = req.body;

        // Users can only update their own profile, admins can update any
        if (req.user.role !== 'admin' && req.user.username !== username) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Check if user exists
        const existingUser = await User.findByUsername(db, username);
        if (!existingUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Only admins can change roles
        if (role && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can change user roles' });
        }

        if (password && password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters long' });
        }

        if (role && !['user', 'admin'].includes(role)) {
            return res.status(400).json({ error: 'Role must be either "user" or "admin"' });
        }

        const updateData = {};
        if (password) updateData.password = password;
        if (role) updateData.role = role;
        if (fullName !== undefined) updateData.fullName = fullName;
        if (department !== undefined) updateData.department = department;
        if (employeeId !== undefined) updateData.employeeId = employeeId;
        if (email !== undefined) updateData.email = email;
        if (phone !== undefined) updateData.phone = phone;

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }

        await User.update(db, username, updateData);
        await Log.create(db, req.user.username, 'Update User', `Updated user: ${username}`);

        res.json({ success: true, message: 'User updated successfully' });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Change user role (admin only)
router.patch('/:username/role', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = await initDatabase();
        const { username } = req.params;
        const { role } = req.body;

        if (!role || !['user', 'admin'].includes(role)) {
            return res.status(400).json({ error: 'Role must be either "user" or "admin"' });
        }

        // Check if user exists
        const existingUser = await User.findByUsername(db, username);
        if (!existingUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        await User.update(db, username, { role });
        await Log.create(db, req.user.username, 'Change Role', `Changed role of ${username} to ${role}`);

        res.json({ success: true, message: `User role changed to ${role}` });
    } catch (error) {
        console.error('Change role error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update user profile/password (admin only or own profile) - PATCH method
router.patch('/:username', authenticateToken, async (req, res) => {
    try {
        const db = await initDatabase();
        const { username } = req.params;
        const { password, fullName, department, employeeId, email, phone } = req.body;

        // Users can only update their own profile, admins can update any
        if (req.user.role !== 'admin' && req.user.username !== username) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Check if user exists
        const existingUser = await User.findByUsername(db, username);
        if (!existingUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (password && password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters long' });
        }

        const updateData = {};
        if (password) updateData.password = password;
        if (fullName !== undefined) updateData.fullName = fullName;
        if (department !== undefined) updateData.department = department;
        if (employeeId !== undefined) updateData.employeeId = employeeId;
        if (email !== undefined) updateData.email = email;
        if (phone !== undefined) updateData.phone = phone;

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }

        await User.update(db, username, updateData);

        const action = password ? 'Change Password' : 'Update Profile';
        await Log.create(db, req.user.username, action, `Updated user profile: ${username}`);

        res.json({ success: true, message: 'User updated successfully' });
    } catch (error) {
        console.error('Update user profile error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;