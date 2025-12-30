const express = require('express');
const { Database, PasswordPolicy, Log } = require('../models/index');
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
// PASSWORD POLICY ROUTES
// ========================

// Get active password policy
router.get('/active', async (req, res) => {
    try {
        const db = await initDatabase();
        const policy = await PasswordPolicy.getActive(db);
        res.json({ success: true, policy });
    } catch (error) {
        console.error('Get active password policy error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all password policies
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = await initDatabase();
        const policies = await PasswordPolicy.getAll(db);
        res.json({ success: true, policies });
    } catch (error) {
        console.error('Get password policies error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create new password policy
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = await initDatabase();
        const {
            name,
            min_length,
            require_uppercase,
            require_lowercase,
            require_numbers,
            require_special_chars,
            max_age_days,
            history_count,
            lockout_attempts,
            lockout_duration_minutes
        } = req.body;

        if (!name || name.trim().length === 0) {
            return res.status(400).json({ error: 'Policy name is required' });
        }

        if (min_length && (min_length < 4 || min_length > 64)) {
            return res.status(400).json({ error: 'Minimum length must be between 4 and 64 characters' });
        }

        const policyData = {
            name: name.trim(),
            min_length: min_length || 8,
            require_uppercase: require_uppercase !== undefined ? require_uppercase : true,
            require_lowercase: require_lowercase !== undefined ? require_lowercase : true,
            require_numbers: require_numbers !== undefined ? require_numbers : true,
            require_special_chars: require_special_chars !== undefined ? require_special_chars : true,
            max_age_days: max_age_days || 90,
            history_count: history_count || 5,
            lockout_attempts: lockout_attempts || 5,
            lockout_duration_minutes: lockout_duration_minutes || 30,
            created_by: req.user.username
        };

        const result = await PasswordPolicy.create(db, policyData);
        await Log.create(db, req.user.username, 'Create Password Policy', `Created password policy: ${name}`);

        res.status(201).json({
            success: true,
            message: 'Password policy created and activated successfully',
            policyId: result.id
        });
    } catch (error) {
        console.error('Create password policy error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Validate password against active policy
router.post('/validate', async (req, res) => {
    try {
        const db = await initDatabase();
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({ error: 'Password is required for validation' });
        }

        const policy = await PasswordPolicy.getActive(db);
        const validation = await PasswordPolicy.validatePassword(password, policy);

        res.json({
            success: true,
            validation,
            policy: policy ? {
                name: policy.name,
                min_length: policy.min_length,
                require_uppercase: policy.require_uppercase,
                require_lowercase: policy.require_lowercase,
                require_numbers: policy.require_numbers,
                require_special_chars: policy.require_special_chars
            } : null
        });
    } catch (error) {
        console.error('Validate password error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;