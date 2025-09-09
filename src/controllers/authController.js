const db = require('../db/database');
const bcrypt = require('bcrypt');

// Login a user
exports.login = (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }

    const sql = 'SELECT * FROM users WHERE username = ?';
    db.get(sql, [username], (err, user) => {
        if (err) {
            console.error('Database error during login:', err.message);
            return res.status(500).json({ error: 'An internal server error occurred.' });
        }
        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password.' });
        }

        bcrypt.compare(password, user.password, (err, result) => {
            if (err) {
                console.error('Error comparing password:', err.message);
                return res.status(500).json({ error: 'An internal server error occurred.' });
            }
            if (result) {
                // Passwords match. Store user info in session, but exclude password.
                req.session.user = {
                    id: user.id,
                    username: user.username,
                    role: user.role
                };
                // Log the login event
                db.run('INSERT INTO login_logs (user_id) VALUES (?)', [user.id]);
                res.status(200).json({ success: true, message: 'Login successful.', user: req.session.user });
            } else {
                // Passwords don't match
                res.status(401).json({ error: 'Invalid username or password.' });
            }
        });
    });
};

// Logout a user
exports.logout = (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ error: 'Failed to log out.' });
        }
        // Clears the cookie
        res.clearCookie('connect.sid');
        res.status(200).json({ success: true, message: 'Logged out successfully.' });
    });
};

// Check authentication status
exports.status = (req, res) => {
    if (req.session.user) {
        res.status(200).json({ isAuthenticated: true, user: req.session.user });
    } else {
        res.status(200).json({ isAuthenticated: false, user: null });
    }
};
