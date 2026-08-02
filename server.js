const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const helmet = require('helmet');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// fs and path already declared above for early logging
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

const uploadsDir = path.join(__dirname, 'public', 'uploads', 'videos');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

const dbPath = require('path').join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT,
                password_hash TEXT,
                role TEXT,
                suspended INTEGER DEFAULT 0
            )`);
        });
    }
});

const uploadMiddleware = multer({ dest: uploadsDir });

// API endpoint for admin login
const loginHandler = async (req, res) => {
    if (Object.keys(req.body || {}).length === 0) {
        return res.status(200).json({ isAuthenticated: req.session.isAuthenticated || false, user: req.session.user || null });
    }
    const { username, password } = req.body;
    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
        req.session.isAuthenticated = true;
        req.session.user = { role: 'admin' };
        res.status(200).json({ isAuthenticated: true, user: { role: 'admin' } });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
};

app.post('/api/login', loginHandler);
app.post('/api/auth/login', loginHandler);

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.status(200).json({ message: 'Logged out' });
});

app.get('/api/auth/status', (req, res) => {
    if (req.session.isAuthenticated) {
        res.status(200).json({ authenticated: true, user: req.session.user || null });
    } else {
        res.status(200).json({ authenticated: false });
    }
});

// Multer-specific error handler (catch file size limits, etc.)
app.use((err, req, res, next) => {
    if (err && err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({ error: 'File size too large' });
    } else {
        next(err);
    }
});

// Mount new routes
app.use('/api/videos', require('./routes/videos')(db, uploadMiddleware, isAdmin));
app.use('/api/admin', require('./routes/admin')(db, uploadMiddleware, isAdmin, isAuthenticated));
app.use('/api/categories', require('./routes/categories')(db, isAdmin));

// Start the server
app.listen(port, () => {
    console.log(`🚀 Server is running on http://localhost:${port}`);
});
