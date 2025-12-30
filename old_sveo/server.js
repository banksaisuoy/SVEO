// Load environment variables from .env file
require('dotenv').config({ path: '.env' });

// Extra imports for robust logging early
const fs = require('fs');
const path = require('path');
const DEBUG_LOG = path.join(__dirname, 'server-debug.log');

// write a synchronous startup line so it's persisted even on abrupt exit
try { fs.appendFileSync(DEBUG_LOG, `[${new Date().toISOString()}] SERVER STARTUP PID:${process.pid}\n`); } catch (e) { console.error('Failed writing debug log', e); }

// Global error handlers to capture unexpected crashes during startup/runtime
process.on('uncaughtException', (err) => {
    const msg = 'UNCAUGHT EXCEPTION: ' + (err && err.stack ? err.stack : String(err));
    console.error(msg);
    try { fs.appendFileSync(DEBUG_LOG, `[${new Date().toISOString()}] ${msg}\n`); } catch (e) {}
});
process.on('unhandledRejection', (reason, promise) => {
    const msg = `UNHANDLED REJECTION at: ${promise} reason: ${reason}`;
    console.error(msg);
    try { fs.appendFileSync(DEBUG_LOG, `[${new Date().toISOString()}] ${msg}\n`); } catch (e) {}
});

process.on('beforeExit', (code) => {
    try { fs.appendFileSync(DEBUG_LOG, `[${new Date().toISOString()}] beforeExit code=${code}\n`); } catch (e) {}
});

process.on('exit', (code) => {
    try { fs.appendFileSync(DEBUG_LOG, `[${new Date().toISOString()}] exit code=${code}\n`); } catch (e) {}
    console.log('Process exiting with code', code);
});

process.on('SIGINT', () => {
    try { fs.appendFileSync(DEBUG_LOG, `[${new Date().toISOString()}] SIGINT received\n`); } catch (e) {}
    console.log('SIGINT received - exiting');
    process.exit(0);
});
process.on('SIGTERM', () => {
    try { fs.appendFileSync(DEBUG_LOG, `[${new Date().toISOString()}] SIGTERM received\n`); } catch (e) {}
    console.log('SIGTERM received - exiting');
    process.exit(0);
});

console.log('Server startup beginning...');

// Import required modules
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const helmet = require('helmet');
const multer = require('multer');
// fs and path already declared above for early logging
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const app = express();
const port = 3000;

// Admin credentials from environment variables (must be defined before DB callbacks use them)
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password';
// Security configuration
const SESSION_SECRET = process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || 'sveo-secret-key';
const BCRYPT_SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);

// Middleware setup
// Security headers
// Configure contentSecurityPolicy to allow external CDNs and inline styles used by the client
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'", 'https:'],
            scriptSrc: ["'self'", 'https:', "'unsafe-inline'"],
            styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            fontSrc: ["'self'", 'https:', 'data:'],
            connectSrc: ["'self'", 'https:'],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            frameAncestors: ["'self'"]
        }
    }
}));
// CORS and body parsing
app.use(cors()); // Enable CORS for all routes (restrict in production if needed)
app.use(express.json()); // Enable JSON body parsing

// Ensure uploads directory and serve it
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
// File size limit configurable via .env (default 500MB)
const UPLOAD_MAX_BYTES = parseInt(process.env.UPLOAD_MAX_BYTES || '524288000', 10);
const upload = multer({ storage, limits: { fileSize: UPLOAD_MAX_BYTES } });

// Use express-session middleware
// Configure express-session with stronger defaults; prefer providing SESSION_SECRET in .env
if (!process.env.SESSION_SECRET) {
    console.warn('WARNING: SESSION_SECRET not set in environment; using fallback. For production set SESSION_SECRET in .env');
}
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: (process.env.NODE_ENV === 'production'), // only send cookie over HTTPS in production
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
    }
}));

// Serve static files from the "public" directory
app.use(express.static('public'));

// SQLite database setup
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        // Create the videos and categories tables if they don't exist
        db.run(`CREATE TABLE IF NOT EXISTS videos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            url TEXT NOT NULL,
            thumbnail_url TEXT,
            category TEXT,
            upload_date TEXT
        )`, (err) => {
            if (err) {
                console.error('Error creating videos table:', err.message);
            }
        });
        db.run(`CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
        )`, (err) => {
            if (err) {
                console.error('Error creating categories table:', err.message);
            }
        });
        // create users table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            suspended INTEGER DEFAULT 0
        )`);
        // Ensure suspended column exists on older DBs
        db.all(`PRAGMA table_info(users)`, [], (err, cols) => {
            if (err) return console.error('PRAGMA error', err.message);
            try {
                const names = (cols || []).map(c => c.name);
                if (!names.includes('suspended')) {
                    db.run(`ALTER TABLE users ADD COLUMN suspended INTEGER DEFAULT 0`, (e) => {
                        if (e) console.error('Failed to add suspended column:', e.message);
                        else console.log('Migrated: added suspended column to users');
                    });
                }
            } catch (e) { console.error('Migration error', e); }
        });
        // create tags and mapping tables
        db.run(`CREATE TABLE IF NOT EXISTS tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS video_tags (
            video_id INTEGER NOT NULL,
            tag_id INTEGER NOT NULL,
            PRIMARY KEY (video_id, tag_id)
        )`);

        // Ensure featured column exists on older videos table
        db.all(`PRAGMA table_info(videos)`, [], (err, cols) => {
            if (err) return console.error('PRAGMA error', err.message);
            try {
                const names = (cols || []).map(c => c.name);
                if (!names.includes('featured')) {
                    db.run(`ALTER TABLE videos ADD COLUMN featured INTEGER DEFAULT 0`, (e) => {
                        if (e) console.error('Failed to add featured column:', e.message);
                        else console.log('Migrated: added featured column to videos');
                    });
                }
            } catch (e) { console.error('Migration error', e); }
        });

        // settings table for site-wide values (title, primary color, etc)
        db.run(`CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )`);

        // comments table (supports optional parent_id for simple replies)
        db.run(`CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            video_id INTEGER NOT NULL,
            user_id INTEGER,
            username TEXT,
            parent_id INTEGER,
            text TEXT NOT NULL,
            created_at TEXT
        )`);
        // problem reports
        db.run(`CREATE TABLE IF NOT EXISTS problem_reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            video_id INTEGER,
            user_id INTEGER,
            username TEXT,
            description TEXT,
            resolved INTEGER DEFAULT 0,
            created_at TEXT
        )`);

        // favorites and watch history
        db.run(`CREATE TABLE IF NOT EXISTS favorites (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            video_id INTEGER NOT NULL,
            created_at TEXT
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS watch_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            video_id INTEGER NOT NULL,
            last_position REAL DEFAULT 0,
            watched_percent REAL DEFAULT 0,
            last_watched_at TEXT
        )`);

        // logs
        db.run(`CREATE TABLE IF NOT EXISTS login_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            username TEXT,
            success INTEGER,
            ip TEXT,
            ts TEXT
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS view_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            video_id INTEGER,
            position REAL,
            watched_percent REAL,
            ts TEXT
        )`);

        // ensure admin account exists in users table
        (async () => {
            try {
                db.get(`SELECT id FROM users WHERE username = ?`, [ADMIN_USERNAME], async (err, row) => {
                    if (err) return console.error('Error checking admin user:', err.message);
                    if (!row) {
                        const hash = await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_SALT_ROUNDS);
                        db.run(`INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')`, [ADMIN_USERNAME, hash]);
                        console.log('Admin user created');
                    }
                });
            } catch (e) { console.error('Failed creating admin user', e); }
        })();
    }
});

// (Admin credentials are declared earlier)

// Middleware to check if the user is authenticated
const isAuthenticated = (req, res, next) => {
    if (req.session.isAuthenticated) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized: You must be logged in to access this resource.' });
    }
};

// API endpoint for admin login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const ts = new Date().toISOString();
        const ip = req.ip || req.connection.remoteAddress || '';

        db.get(`SELECT id, username, password_hash, role FROM users WHERE username = ?`, [username], async (err, user) => {
            if (err) {
                console.error('DB error on login:', err.message);
                return res.status(500).json({ error: 'Internal error' });
            }

            // No user: fallback to ENV admin credentials for bootstrap
            if (!user) {
                if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
                    req.session.isAuthenticated = true;
                    req.session.user = { username: ADMIN_USERNAME, role: 'admin' };
                    db.run(`INSERT INTO login_logs (user_id, username, success, ip, ts) VALUES (?, ?, ?, ?, ?)`, [null, username, 1, ip, ts]);
                    return res.status(200).json({ success: true, message: 'Login successful', user: req.session.user });
                }
                db.run(`INSERT INTO login_logs (user_id, username, success, ip, ts) VALUES (?, ?, ?, ?, ?)`, [null, username, 0, ip, ts]);
                return res.status(401).json({ error: 'Invalid username or password' });
            }

            // Check if suspended column exists and read it safely
            db.all(`PRAGMA table_info(users)`, [], (e, cols) => {
                if (e) {
                    console.error('PRAGMA error', e.message);
                    return finishAuth(0);
                }
                const names = (cols || []).map(c => c.name);
                if (!names.includes('suspended')) return finishAuth(0);
                db.get(`SELECT suspended FROM users WHERE username = ?`, [username], (ee, row) => {
                    const suspended = (!ee && row) ? (row.suspended || 0) : 0;
                    return finishAuth(suspended);
                });
            });

            async function finishAuth(suspended) {
                if (suspended) {
                    db.run(`INSERT INTO login_logs (user_id, username, success, ip, ts) VALUES (?, ?, ?, ?, ?)`, [user.id, username, 0, ip, ts]);
                    return res.status(403).json({ error: 'Account suspended' });
                }
                const ok = await bcrypt.compare(password, user.password_hash);
                db.run(`INSERT INTO login_logs (user_id, username, success, ip, ts) VALUES (?, ?, ?, ?, ?)`, [user.id, username, ok ? 1 : 0, ip, ts]);
                if (ok) {
                    req.session.isAuthenticated = true;
                    req.session.user = { id: user.id, username: user.username, role: user.role };
                    return res.status(200).json({ success: true, message: 'Login successful', user: req.session.user });
                }
                return res.status(401).json({ error: 'Invalid username or password' });
            }
        });
    } catch (err) {
        console.error('Login error:', err.message);
        res.status(500).json({ error: 'An unexpected error occurred during login.' });
    }
});

// NEW: API endpoint for admin logout
app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ error: 'Failed to log out.' });
        }
        res.status(200).json({ success: true, message: 'Logged out successfully' });
    });
});

// NEW: API endpoint to check login status
app.get('/api/auth/status', (req, res) => {
    res.status(200).json({ isAuthenticated: req.session.isAuthenticated || false, user: req.session.user || null });
});

// GET all videos (Public access)
app.get('/api/videos', (req, res) => {
    const sql = `SELECT * FROM videos ORDER BY upload_date DESC`;
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error('Error fetching videos:', err.message);
            return res.status(500).json({ error: 'Failed to fetch videos.' });
        }
        res.status(200).json(rows);
    });
});

// POST a new video (Admin only)
// Supports JSON body (link) or multipart/form-data (file)
app.post('/api/videos', isAuthenticated, upload.single('file'), (req, res) => {
    // Only admin may add videos
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const { title, description, url, thumbnail_url, category } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required.' });
    let videoUrl = url;
    if (req.file) videoUrl = `/uploads/${req.file.filename}`;
    if (!videoUrl) return res.status(400).json({ error: 'Provide url or upload file.' });
    const upload_date = new Date().toISOString();
    const sql = `INSERT INTO videos (title, description, url, thumbnail_url, category, upload_date) VALUES (?, ?, ?, ?, ?, ?)`;
    db.run(sql, [title, description || '', videoUrl, thumbnail_url || '', category || '', upload_date], function(err) {
        if (err) {
            console.error('Error adding video:', err.message);
            return res.status(500).json({ error: 'Failed to add video.' });
        }
        res.status(201).json({ id: this.lastID, title, url: videoUrl, message: 'Video added successfully.' });
    });
});

// Multer-specific error handler (catch file size limits, etc.)
app.use((err, req, res, next) => {
    if (err && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'File too large' });
    }
    // pass to default error handler
    next(err);
});

// User management endpoints (admin only)
app.get('/api/users', isAuthenticated, (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    db.all(`SELECT id, username, role, suspended FROM users ORDER BY username`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Failed to fetch users.' });
        res.json(rows);
    });
});

app.post('/api/users', isAuthenticated, async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const { username, password, role } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'username and password required' });
    const hash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    db.run(`INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)`, [username, hash, role || 'user'], function(err) {
        if (err) return res.status(500).json({ error: 'Failed to create user' });
        res.status(201).json({ id: this.lastID, username, role: role || 'user' });
    });
});

app.put('/api/users/:username/role', isAuthenticated, (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const { username } = req.params; const { role } = req.body;
    db.run(`UPDATE users SET role = ? WHERE username = ?`, [role, username], function(err) {
        if (err) return res.status(500).json({ error: 'Failed to update role' });
        res.json({ message: 'updated' });
    });
});

// Suspend/un-suspend user
app.put('/api/users/:username/suspend', isAuthenticated, (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const { username } = req.params; const { suspended } = req.body;
    db.run(`UPDATE users SET suspended = ? WHERE username = ?`, [suspended ? 1 : 0, username], function(err) {
        if (err) return res.status(500).json({ error: 'Failed to update suspended flag' });
        res.json({ message: 'updated' });
    });
});

app.delete('/api/users/:username', isAuthenticated, (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const { username } = req.params;
    // Require that user is suspended before allowing deletion to avoid accidental removals
    db.get(`SELECT suspended FROM users WHERE username = ?`, [username], (err, row) => {
        if (err) return res.status(500).json({ error: 'DB error' });
        if (!row) return res.status(404).json({ error: 'User not found' });
        if (!row.suspended) return res.status(400).json({ error: 'User must be suspended before deletion. Use suspend first.' });
        db.run(`DELETE FROM users WHERE username = ?`, [username], function(err2) {
            if (err2) return res.status(500).json({ error: 'Failed to delete' });
            res.json({ message: 'deleted' });
        });
    });
});

// DELETE a video (Admin only)
app.delete('/api/videos/:id', isAuthenticated, (req, res) => {
    const { id } = req.params;
    const sql = `DELETE FROM videos WHERE id = ?`;
    db.run(sql, id, function(err) {
        if (err) {
            console.error('Error deleting video:', err.message);
            return res.status(500).json({ error: 'Failed to delete video.' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Video not found.' });
        }
        res.status(200).json({ message: 'Video deleted successfully.' });
    });
});

// GET all categories (Public access)
app.get('/api/categories', (req, res) => {
    const sql = `SELECT * FROM categories ORDER BY name ASC`;
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error('Error fetching categories:', err.message);
            return res.status(500).json({ error: 'Failed to fetch categories.' });
        }
        res.status(200).json(rows);
    });
});

// Simple streaming proxy for public OneDrive / SharePoint (and similar) links
// Usage: GET /api/proxy?url=<encoded_url>
// This forwards Range requests to the remote host to support seeking.
app.get('/api/proxy', (req, res) => {
    const target = req.query.url;
    if (!target) return res.status(400).json({ error: 'Missing url parameter' });
    let targetUrl;
    try {
        targetUrl = new URL(decodeURIComponent(target));
    } catch (err) {
        return res.status(400).json({ error: 'Invalid url' });
    }

    // Allow only certain hosts to be proxied for safety
    const allowedHosts = [
        'onedrive.live.com',
        '1drv.ms',
        'sharepoint.com',
        'public.blob.core.windows.net',
        'cdn.sharepointonline.com'
    ];
    const host = targetUrl.hostname.toLowerCase();
    const hostAllowed = allowedHosts.some(h => host.endsWith(h));
    if (!hostAllowed) return res.status(403).json({ error: 'Host not allowed' });

    const httpLib = targetUrl.protocol === 'https:' ? require('https') : require('http');

    const options = {
        method: 'GET',
        headers: {}
    };

    // Forward Range header if present to support seeking
    if (req.headers.range) options.headers.Range = req.headers.range;

    const proxyReq = httpLib.request(targetUrl, options, (proxyRes) => {
        // Copy status and selected headers
        res.statusCode = proxyRes.statusCode || 200;
        const headersToCopy = ['content-type', 'content-length', 'accept-ranges', 'content-range', 'cache-control', 'last-modified'];
        headersToCopy.forEach(h => {
            if (proxyRes.headers[h]) res.setHeader(h, proxyRes.headers[h]);
        });
        // Stream the response
        proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
        console.error('Proxy request error:', err.message);
        if (!res.headersSent) res.status(502).json({ error: 'Failed to fetch remote resource' });
    });

    proxyReq.end();
});

// POST a new category (Admin only)
app.post('/api/categories', isAuthenticated, (req, res) => {
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'Category name is required.' });
    }
    const sql = `INSERT INTO categories (name) VALUES (?)`;
    db.run(sql, [name], function(err) {
        if (err) {
            console.error('Error adding category:', err.message);
            return res.status(500).json({ error: 'Failed to add category. Category may already exist.' });
        }
        res.status(201).json({ id: this.lastID, name, message: 'Category added successfully.' });
    });
});

// --- Tag management ---
app.get('/api/tags', (req, res) => {
    db.all(`SELECT * FROM tags ORDER BY name`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Failed to fetch tags' });
        res.json(rows);
    });
});

// Return only tags that are actually assigned to videos along with usage count
app.get('/api/tags/used', (req, res) => {
    const sql = `SELECT t.id, t.name, COUNT(vt.video_id) as usage FROM tags t JOIN video_tags vt ON t.id = vt.tag_id GROUP BY t.id ORDER BY usage DESC`;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Failed to fetch used tags' });
        res.json(rows || []);
    });
});

app.post('/api/tags', isAuthenticated, (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    db.run(`INSERT INTO tags (name) VALUES (?)`, [name], function(err) {
        if (err) return res.status(500).json({ error: 'Failed to add tag' });
        res.status(201).json({ id: this.lastID, name });
    });
});

app.put('/api/tags/:id', isAuthenticated, (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const { id } = req.params; const { name } = req.body;
    db.run(`UPDATE tags SET name = ? WHERE id = ?`, [name, id], function(err) {
        if (err) return res.status(500).json({ error: 'Failed to update tag' });
        res.json({ message: 'updated' });
    });
});

app.delete('/api/tags/:id', isAuthenticated, (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const { id } = req.params;
    db.run(`DELETE FROM tags WHERE id = ?`, [id], function(err) {
        if (err) return res.status(500).json({ error: 'Failed to delete tag' });
        res.json({ message: 'deleted' });
    });
});

// Assign tags to videos
app.post('/api/videos/:id/tags', isAuthenticated, (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const videoId = req.params.id; const { tagIds } = req.body; // array of tag ids
    if (!Array.isArray(tagIds)) return res.status(400).json({ error: 'tagIds array required' });
    const stmt = db.prepare(`INSERT OR IGNORE INTO video_tags (video_id, tag_id) VALUES (?, ?)`);
    db.serialize(() => {
        tagIds.forEach(tid => stmt.run(videoId, tid));
        stmt.finalize(err => {
            if (err) return res.status(500).json({ error: 'Failed to assign tags' });
            res.json({ message: 'tags assigned' });
        });
    });
});

// Get videos filtered by tag
app.get('/api/videos/by-tag/:tagId', (req, res) => {
    const tagId = req.params.tagId;
    const sql = `SELECT v.* FROM videos v JOIN video_tags vt ON v.id = vt.video_id WHERE vt.tag_id = ? ORDER BY v.upload_date DESC`;
    db.all(sql, [tagId], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Failed to fetch videos by tag' });
        res.json(rows);
    });
});

// --- Favorites ---
app.post('/api/favorites', isAuthenticated, (req, res) => {
    const user = req.session.user;
    const { video_id } = req.body;
    if (!video_id) return res.status(400).json({ error: 'video_id required' });
    const ts = new Date().toISOString();
    db.run(`INSERT INTO favorites (user_id, video_id, created_at) VALUES (?, ?, ?)`, [user.id, video_id, ts], function(err) {
        if (err) return res.status(500).json({ error: 'Failed to add favorite' });
        res.json({ id: this.lastID });
    });
});

app.delete('/api/favorites/:videoId', isAuthenticated, (req, res) => {
    const user = req.session.user; const videoId = req.params.videoId;
    db.run(`DELETE FROM favorites WHERE user_id = ? AND video_id = ?`, [user.id, videoId], function(err) {
        if (err) return res.status(500).json({ error: 'Failed to remove favorite' });
        res.json({ message: 'deleted' });
    });
});

app.get('/api/favorites', isAuthenticated, (req, res) => {
    const user = req.session.user;
    const sql = `SELECT v.* FROM videos v JOIN favorites f ON v.id = f.video_id WHERE f.user_id = ? ORDER BY f.created_at DESC`;
    db.all(sql, [user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Failed to fetch favorites' });
        res.json(rows);
    });
});

// --- Watch history / view logging ---
app.post('/api/watch', isAuthenticated, (req, res) => {
    const user = req.session.user;
    const { video_id, position, watched_percent } = req.body;
    const ts = new Date().toISOString();
    db.run(`INSERT INTO view_logs (user_id, video_id, position, watched_percent, ts) VALUES (?, ?, ?, ?, ?)`, [user.id, video_id, position || 0, watched_percent || 0, ts]);
    // upsert last position in watch_history
    db.run(`INSERT INTO watch_history (user_id, video_id, last_position, watched_percent, last_watched_at) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(user_id, video_id) DO UPDATE SET last_position=excluded.last_position, watched_percent=excluded.watched_percent, last_watched_at=excluded.last_watched_at
    `, [user.id, video_id, position || 0, watched_percent || 0, ts], function(err) {
        // Not all sqlite builds support ON CONFLICT with DO UPDATE via this driver; fallback simple update
        if (err) {
            db.get(`SELECT id FROM watch_history WHERE user_id = ? AND video_id = ?`, [user.id, video_id], (e, row) => {
                if (e) return res.status(500).json({ error: 'Failed updating history' });
                if (row) {
                    db.run(`UPDATE watch_history SET last_position = ?, watched_percent = ?, last_watched_at = ? WHERE id = ?`, [position || 0, watched_percent || 0, ts, row.id]);
                } else {
                    db.run(`INSERT INTO watch_history (user_id, video_id, last_position, watched_percent, last_watched_at) VALUES (?, ?, ?, ?, ?)`, [user.id, video_id, position || 0, watched_percent || 0, ts]);
                }
                res.json({ message: 'ok' });
            });
        } else {
            res.json({ message: 'ok' });
        }
    });
});

app.get('/api/history', isAuthenticated, (req, res) => {
    const user = req.session.user;
    db.all(`SELECT h.*, v.title, v.url FROM watch_history h JOIN videos v ON v.id = h.video_id WHERE h.user_id = ? ORDER BY h.last_watched_at DESC`, [user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Failed to fetch history' });
        res.json(rows);
    });
});

// Record or update a watch history entry (lightweight)
app.post('/api/history', isAuthenticated, (req, res) => {
    const user = req.session.user; if (!user) return res.status(403).json({ error: 'Forbidden' });
    const { video_id, position, watched_percent } = req.body || {};
    const ts = new Date().toISOString();
    db.get(`SELECT id FROM watch_history WHERE user_id = ? AND video_id = ?`, [user.id, video_id], (err, row) => {
        if (err) return res.status(500).json({ error: 'DB error' });
        if (row) {
            db.run(`UPDATE watch_history SET last_position = ?, watched_percent = ?, last_watched_at = ? WHERE id = ?`, [position || 0, watched_percent || 0, ts, row.id], function(e) { if (e) return res.status(500).json({ error: 'Failed to update' }); res.json({ message: 'updated' }); });
        } else {
            db.run(`INSERT INTO watch_history (user_id, video_id, last_position, watched_percent, last_watched_at) VALUES (?, ?, ?, ?, ?)`, [user.id, video_id, position || 0, watched_percent || 0, ts], function(e) { if (e) return res.status(500).json({ error: 'Failed to insert' }); res.json({ message: 'inserted' }); });
        }
    });
});

// --- Admin logs ---
app.get('/api/admin/login-logs', isAuthenticated, (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    db.all(`SELECT * FROM login_logs ORDER BY ts DESC LIMIT 500`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Failed to fetch logs' });
        res.json(rows);
    });
});

app.get('/api/admin/view-logs', isAuthenticated, (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    db.all(`SELECT * FROM view_logs ORDER BY ts DESC LIMIT 1000`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Failed to fetch view logs' });
        res.json(rows);
    });
});

// --- Site settings (admin) ---
app.get('/api/settings', isAuthenticated, (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    db.all(`SELECT key, value FROM settings`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Failed to fetch settings' });
        const out = {};
        (rows||[]).forEach(r => out[r.key] = r.value);
        res.json(out);
    });
});

app.put('/api/settings', isAuthenticated, (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const updates = req.body || {};
    const keys = Object.keys(updates);
    if (!keys.length) return res.status(400).json({ error: 'No settings provided' });
    const stmt = db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`);
    db.serialize(() => {
        keys.forEach(k => stmt.run(k, String(updates[k])));
        stmt.finalize(err => { if (err) return res.status(500).json({ error: 'Failed to update settings' }); res.json({ message: 'updated' }); });
    });
});

// --- Comments ---
app.post('/api/videos/:id/comments', isAuthenticated, (req, res) => {
    const videoId = req.params.id; const { text, parent_id } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Comment text required' });
    const ts = new Date().toISOString();
    const user = req.session.user || null;
    db.run(`INSERT INTO comments (video_id, user_id, username, parent_id, text, created_at) VALUES (?, ?, ?, ?, ?, ?)`, [videoId, user && user.id || null, user && user.username || 'Guest', parent_id || null, text, ts], function(err) {
        if (err) return res.status(500).json({ error: 'Failed to post comment' });
        res.status(201).json({ id: this.lastID, video_id: videoId, text, created_at: ts });
    });
});

// --- Problem reports ---
// Users can report a problem with a video
app.post('/api/reports', isAuthenticated, (req, res) => {
    const { video_id, description } = req.body;
    if (!description) return res.status(400).json({ error: 'description required' });
    const user = req.session.user || null;
    const ts = new Date().toISOString();
    db.run(`INSERT INTO problem_reports (video_id, user_id, username, description, created_at) VALUES (?, ?, ?, ?, ?)`, [video_id || null, user && user.id || null, user && user.username || 'Guest', description, ts], function(err) {
        if (err) return res.status(500).json({ error: 'Failed to submit report' });
        res.status(201).json({ id: this.lastID });
    });
});

// Admin: list reports
app.get('/api/admin/reports', isAuthenticated, (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    db.all(`SELECT * FROM problem_reports ORDER BY created_at DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Failed to fetch reports' });
        res.json(rows);
    });
});

// Admin: mark report resolved
app.put('/api/admin/reports/:id/resolve', isAuthenticated, (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const id = req.params.id; const { resolved } = req.body;
    db.run(`UPDATE problem_reports SET resolved = ? WHERE id = ?`, [resolved ? 1 : 0, id], function(err) {
        if (err) return res.status(500).json({ error: 'Failed to update' });
        res.json({ message: 'updated' });
    });
});

app.get('/api/videos/:id/comments', (req, res) => {
    const videoId = req.params.id;
    db.all(`SELECT * FROM comments WHERE video_id = ? ORDER BY created_at ASC`, [videoId], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Failed to fetch comments' });
        res.json(rows);
    });
});

app.delete('/api/comments/:id', isAuthenticated, (req, res) => {
    const id = req.params.id; const user = req.session.user;
    // allow admins or comment owner to delete
    db.get(`SELECT user_id FROM comments WHERE id = ?`, [id], (err, row) => {
        if (err) return res.status(500).json({ error: 'DB error' });
        if (!row) return res.status(404).json({ error: 'Not found' });
        if (user.role !== 'admin' && row.user_id !== user.id) return res.status(403).json({ error: 'Forbidden' });
        db.run(`DELETE FROM comments WHERE id = ?`, [id], function(e) { if (e) return res.status(500).json({ error: 'Failed' }); res.json({ message: 'deleted' }); });
    });
});

// --- Featured / Trending ---
app.put('/api/videos/:id/featured', isAuthenticated, (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const id = req.params.id; const { featured } = req.body;
    db.run(`UPDATE videos SET featured = ? WHERE id = ?`, [featured ? 1 : 0, id], function(err) { if (err) return res.status(500).json({ error: 'Failed' }); res.json({ message: 'updated' }); });
});

// Trending: simple heuristic — top recent by views in view_logs
app.get('/api/videos/trending', (req, res) => {
    // count views from the last 7 days
    const sql = `SELECT v.*, COUNT(vl.id) as views FROM videos v LEFT JOIN view_logs vl ON vl.video_id = v.id AND vl.ts >= datetime('now', '-7 days') GROUP BY v.id ORDER BY views DESC, v.upload_date DESC LIMIT 5`;
    db.all(sql, [], (err, rows) => { if (err) return res.status(500).json({ error: 'Failed' }); res.json(rows); });
});

// Client-side error reporting endpoint (allows client to POST stack traces for debugging)
app.post('/api/client-error', (req, res) => {
    try {
        const data = req.body || {};
        const entry = `[${new Date().toISOString()}] CLIENT_ERROR from ${req.ip || req.connection.remoteAddress}: ${JSON.stringify(data)}\n`;
        try { fs.appendFileSync(DEBUG_LOG, entry); } catch (e) { console.error('Failed writing client error to debug log', e); }
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to record client error' });
    }
});

// Update user details (username/password) — admin-only
app.put('/api/users/:username', isAuthenticated, async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const username = req.params.username; const { newUsername, newPassword, role } = req.body;
    // allow changing username, password and role
    db.get(`SELECT id FROM users WHERE username = ?`, [username], async (err, row) => {
        if (err) return res.status(500).json({ error: 'DB error' });
        if (!row) return res.status(404).json({ error: 'User not found' });
        const updates = [];
        const params = [];
        if (newUsername) { updates.push('username = ?'); params.push(newUsername); }
    if (newPassword) { const h = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS); updates.push('password_hash = ?'); params.push(h); }
        if (role) { updates.push('role = ?'); params.push(role); }
        if (!updates.length) return res.json({ message: 'no changes' });
        params.push(username);
        const sql = `UPDATE users SET ${updates.join(', ')} WHERE username = ?`;
        db.run(sql, params, function(e) { if (e) return res.status(500).json({ error: 'Failed to update' }); res.json({ message: 'updated' }); });
    });
});

// Admin endpoints to inspect a user's history and favorites
app.get('/api/admin/users/:id/history', isAuthenticated, (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const uid = req.params.id;
    db.all(`SELECT h.*, v.title, v.url FROM watch_history h JOIN videos v ON v.id = h.video_id WHERE h.user_id = ? ORDER BY h.last_watched_at DESC`, [uid], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Failed to fetch user history' });
        res.json(rows);
    });
});

app.get('/api/admin/users/:id/favorites', isAuthenticated, (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const uid = req.params.id;
    db.all(`SELECT v.* FROM videos v JOIN favorites f ON v.id = f.video_id WHERE f.user_id = ? ORDER BY f.created_at DESC`, [uid], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Failed to fetch user favorites' });
        res.json(rows);
    });
});

// DELETE a category (Admin only)
app.delete('/api/categories/:id', isAuthenticated, (req, res) => {
    const { id } = req.params;
    const sql = `DELETE FROM categories WHERE id = ?`;
    db.run(sql, id, function(err) {
        if (err) {
            console.error('Error deleting category:', err.message);
            return res.status(500).json({ error: 'Failed to delete category.' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Category not found.' });
        }
        res.status(200).json({ message: 'Category deleted successfully.' });
    });
});

// Start the server
app.listen(port, () => {
    console.log(`🚀 Server is running on http://localhost:${port}`);
});

// Heartbeat to help detect unexpected exits in some environments.
setInterval(() => {
    try { console.log('heartbeat - server running'); } catch (e) {}
}, 5000);
