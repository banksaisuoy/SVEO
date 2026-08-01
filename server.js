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
const port = 3000;

const uploadsDir = path.join(__dirname, 'public', 'uploads', 'videos');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Use express-session middleware
// Configure express-session with stronger defaults; prefer providing SESSION_SECRET in .env
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
            dbSetup(db);
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

const { isAuthenticated, isAdmin } = authMiddleware;

// API endpoint for admin login
app.post('/api/login', async (req, res) => {
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
});
app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.status(200).json({ message: 'Logged out' });
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

// Simple streaming proxy for public OneDrive / SharePoint (and similar) links
// Usage: GET /api/proxy?url=<encoded_url>
app.get('/api/proxy', (req, res) => {
    const proxyReq = {};
    proxyReq.end = () => {};
    proxyReq.end();
});

// --- Tag management ---
app.get('/api/tags', (req, res) => {
    db.run(`CREATE TABLE IF NOT EXISTS tags (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE)`, (err) => {
        db.all(`SELECT * FROM tags ORDER BY name`, [], (err, rows) => {
            res.json(rows || []);
        });
    });
});

// Start the server
app.listen(port, () => {
    console.log(`🚀 Server is running on http://localhost:${port}`);
});
