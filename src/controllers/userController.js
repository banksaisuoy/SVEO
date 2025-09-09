const db = require('../db/database');
const bcrypt = require('bcrypt');

// GET all users (Admin only)
exports.getAllUsers = (req, res) => {
    // Exclude passwords from the result
    const sql = 'SELECT id, username, role FROM users';
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error('Error fetching users:', err.message);
            return res.status(500).json({ error: 'Failed to fetch users.' });
        }
        res.status(200).json(rows);
    });
};

// CREATE a new user (Admin only)
exports.createUser = (req, res) => {
    const { username, password, role } = req.body;

    if (!username || !password || !role) {
        return res.status(400).json({ error: 'Username, password, and role are required.' });
    }
    if (!['admin', 'user'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role specified.' });
    }

    bcrypt.hash(password, 10, (err, hash) => {
        if (err) {
            console.error('Error hashing password:', err.message);
            return res.status(500).json({ error: 'Failed to create user.' });
        }

        const sql = 'INSERT INTO users (username, password, role) VALUES (?, ?, ?)';
        db.run(sql, [username, hash, role], function(err) {
            if (err) {
                console.error('Error creating user:', err.message);
                if (err.code === 'SQLITE_CONSTRAINT') {
                    return res.status(409).json({ error: 'User with this username already exists.' });
                }
                return res.status(500).json({ error: 'Failed to create user.' });
            }
            res.status(201).json({ id: this.lastID, username, role, message: 'User created successfully.' });
        });
    });
};

// UPDATE a user (Admin only)
exports.updateUser = (req, res) => {
    const { id } = req.params;
    const { username, role } = req.body;

    if (!username || !role) {
        return res.status(400).json({ error: 'Username and role are required.' });
    }
    if (!['admin', 'user'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role specified.' });
    }

    const sql = 'UPDATE users SET username = ?, role = ? WHERE id = ?';
    db.run(sql, [username, role, id], function(err) {
        if (err) {
            console.error('Error updating user:', err.message);
            return res.status(500).json({ error: 'Failed to update user.' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }
        res.status(200).json({ message: 'User updated successfully.' });
    });
};

// DELETE a user (Admin only)
exports.deleteUser = (req, res) => {
    const { id } = req.params;

    // Optional: Prevent admin from deleting themselves
    if (req.session.user && req.session.user.id == id) {
        return res.status(403).json({ error: 'You cannot delete your own account.' });
    }

    const sql = 'DELETE FROM users WHERE id = ?';
    db.run(sql, id, function(err) {
        if (err) {
            console.error('Error deleting user:', err.message);
            return res.status(500).json({ error: 'Failed to delete user.' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }
        res.status(200).json({ message: 'User deleted successfully.' });
    });
};
