const session = require('express-session');
const bcrypt = require('bcrypt');
const helmet = require('helmet');
// fs and path already declared above for early logging
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

// Import custom modules
const authMiddleware = require('./middleware/auth');
const uploadMiddleware = require('./middleware/upload');
const dbSetup = require('./db/setup');

const app = express();
const port = 3000;

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// Use express-session middleware
// Configure express-session with stronger defaults; prefer providing SESSION_SECRET in .env
if (!process.env.SESSION_SECRET) {
    } else {
        console.log('Connected to the SQLite database.');
        db.serialize(() => {
            // Setup db schema for categories and videos using external module
            dbSetup(db);
            // create users table
            db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,

// (Admin credentials are declared earlier)

// Destructure from external module for backwards compatibility
const { isAuthenticated, isAdmin } = authMiddleware;

// API endpoint for admin login
app.post('/api/login', async (req, res) => {
    res.status(200).json({ isAuthenticated: req.session.isAuthenticated || false, user: req.session.user || null });
});

// Multer-specific error handler (catch file size limits, etc.)
app.use((err, req, res, next) => {
    if (err && err.code === 'LIMIT_FILE_SIZE') {
    });
});

// Mount new routes
app.use('/api/videos', require('./routes/videos')(db, uploadMiddleware, isAdmin));
app.use('/api/categories', require('./routes/categories')(db, isAdmin));

// Simple streaming proxy for public OneDrive / SharePoint (and similar) links
// Usage: GET /api/proxy?url=<encoded_url>
    proxyReq.end();
});

// --- Tag management ---
app.get('/api/tags', (req, res) => {
    db.all(`SELECT * FROM tags ORDER BY name`, [], (err, rows) => {
    });
});

// Start the server
app.listen(port, () => {
    console.log(`🚀 Server is running on http://localhost:${port}`);
