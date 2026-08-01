    } else {
        console.log('Connected to the SQLite database.');
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS videos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT,
                description TEXT,
                category_id INTEGER,
                category TEXT,
                file_path TEXT,
                thumbnail_path TEXT,
                video_url TEXT,
                thumbnail_url TEXT,
                duration INTEGER,
                created_at TEXT,
                updated_at TEXT
            )`);
            db.run(`CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE
            )`);
            db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT,
    }
});

const isAuthenticated = (req, res, next) => {
    if (req.session.isAuthenticated) {
        return next();
    }
    res.status(401).json({ error: 'Unauthorized' });
};

const isAdmin = (req, res, next) => {
    if (req.session.isAuthenticated && req.session.user && req.session.user.role === 'admin') {
        return next();
    }
    res.status(403).json({ error: 'Forbidden' });
};

const multer = require('multer');
const uploadMiddleware = multer({ dest: uploadsDir });

// API endpoint for admin login
app.post('/api/login', async (req, res) => {
