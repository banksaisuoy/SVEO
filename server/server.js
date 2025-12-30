// Load environment variables
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Database setup
const { Database } = require('./models/index');
const dbInstance = new Database(path.join(__dirname, 'visionhub.db'));
let db;

// Initialize database connection and start server
async function initializeApp() {
    try {
        db = await dbInstance.connect();
        console.log('Connected to SQLite database.');
        await initDatabase();
        // Create database indexes for optimization
        await dbInstance.createIndexes();

        // Make database available to routes
        app.set('db', db);

        // Import API routes after database is connected
        const apiRoutes = require('./routes');
        const healthMonitor = require('./services/healthMonitor');
        const aiService = require('./services/aiService');
        const apiManager = require('./middleware/apiManager');

        // Get rate limiters
        const rateLimiters = apiManager.getRateLimiters();

        // Apply middleware
        app.use(apiManager.securityHeaders());
        app.use(apiManager.requestMonitor());
        app.use(apiManager.validateApiKey());

        // Apply rate limiting to different route groups
        app.use('/api/auth', rateLimiters.auth);
        app.use('/api/ai', rateLimiters.ai);
        app.use('/api/uploads', rateLimiters.files);
        app.use('/api', rateLimiters.general);

        // Mount API routes
        app.use('/api', apiRoutes);

        // Serve frontend
        app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, '../public/index.html'));
        });

        // Catch-all handler: send back index.html for client-side routing
        app.get('*', (req, res) => {
            res.sendFile(path.join(__dirname, '../public/index.html'));
        });

        // Export app and db for use in other files
        module.exports = { app, db, authenticateToken, requireAdmin, logAction, JWT_SECRET };

        // Start server
        app.listen(PORT, async () => {
            console.log(`Server running on http://localhost:${PORT}`);

            // Initialize AI service
            try {
                // Pass database connection to AI service
                const aiService = require('./services/aiService');
                aiService.setDatabase(db);
                await aiService.initialize();
                console.log('AI Service initialized');
            } catch (error) {
                console.warn('AI Service initialization failed:', error.message);
            }

            // Start health monitoring
            healthMonitor.startMonitoring();
            console.log('System health monitoring started');
        });
    } catch (error) {
        console.error('Failed to initialize application:', error.message);
        process.exit(1);
    }
}

// Initialize database tables
function initDatabase() {
    // Ensure upload directories exist
    const fs = require('fs');
    const path = require('path');
    const uploadDirs = [
        path.join(__dirname, '../public/uploads'),
        path.join(__dirname, '../public/uploads/videos'),
        path.join(__dirname, '../public/uploads/thumbnails')
    ];

    uploadDirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            try {
                fs.mkdirSync(dir, { recursive: true });
                console.log(`Created upload directory: ${dir}`);
            } catch (error) {
                console.error(`Failed to create upload directory ${dir}:`, error.message);
            }
        }
    });

    const tables = [
        `CREATE TABLE IF NOT EXISTS users (
            username TEXT PRIMARY KEY,
            password TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            fullName TEXT,
            department TEXT,
            employeeId TEXT,
            email TEXT,
            phone TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS videos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            thumbnailUrl TEXT,
            videoUrl TEXT NOT NULL,
            optimizedUrl TEXT,
            views INTEGER DEFAULT 0,
            isFeatured BOOLEAN DEFAULT 0,
            categoryId INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(categoryId) REFERENCES categories(id)
        )`,
        `CREATE TABLE IF NOT EXISTS user_favorites (
            userId TEXT,
            videoId INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (userId, videoId),
            FOREIGN KEY(userId) REFERENCES users(username),
            FOREIGN KEY(videoId) REFERENCES videos(id)
        )`,
        `CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            videoId INTEGER,
            userId TEXT,
            text TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(videoId) REFERENCES videos(id),
            FOREIGN KEY(userId) REFERENCES users(username)
        )`,
        `CREATE TABLE IF NOT EXISTS reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId TEXT,
            videoId INTEGER,
            reason TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(userId) REFERENCES users(username),
            FOREIGN KEY(videoId) REFERENCES videos(id)
        )`,
        `CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId TEXT,
            action TEXT NOT NULL,
            details TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(userId) REFERENCES users(username)
        )`,
        `CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        // Additional tables for enterprise features
        `CREATE TABLE IF NOT EXISTS tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            description TEXT,
            color TEXT DEFAULT '#2563eb',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS video_tags (
            videoId INTEGER,
            tagId INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (videoId, tagId),
            FOREIGN KEY(videoId) REFERENCES videos(id) ON DELETE CASCADE,
            FOREIGN KEY(tagId) REFERENCES tags(id) ON DELETE CASCADE
        )`,
        `CREATE TABLE IF NOT EXISTS playlists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            userId TEXT,
            is_public BOOLEAN DEFAULT 0,
            is_active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(userId) REFERENCES users(username)
        )`,
        `CREATE TABLE IF NOT EXISTS playlist_videos (
            playlistId INTEGER,
            videoId INTEGER,
            position INTEGER,
            added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (playlistId, videoId),
            FOREIGN KEY(playlistId) REFERENCES playlists(id) ON DELETE CASCADE,
            FOREIGN KEY(videoId) REFERENCES videos(id) ON DELETE CASCADE
        )`,
        `CREATE TABLE IF NOT EXISTS user_groups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            description TEXT,
            color TEXT DEFAULT '#3b82f6',
            is_active BOOLEAN DEFAULT 1,
            created_by TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(created_by) REFERENCES users(username)
        )`,
        `CREATE TABLE IF NOT EXISTS user_group_members (
            group_id INTEGER,
            username TEXT,
            role_in_group TEXT DEFAULT 'member',
            added_by TEXT,
            is_active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (group_id, username),
            FOREIGN KEY(group_id) REFERENCES user_groups(id) ON DELETE CASCADE,
            FOREIGN KEY(username) REFERENCES users(username) ON DELETE CASCADE,
            FOREIGN KEY(added_by) REFERENCES users(username)
        )`,
        `CREATE TABLE IF NOT EXISTS permissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            description TEXT,
            category TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS user_permissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT,
            permission_id INTEGER,
            granted_by TEXT,
            is_active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(username, permission_id),
            FOREIGN KEY(username) REFERENCES users(username) ON DELETE CASCADE,
            FOREIGN KEY(permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
            FOREIGN KEY(granted_by) REFERENCES users(username)
        )`,
        `CREATE TABLE IF NOT EXISTS group_permissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            group_id INTEGER,
            permission_id INTEGER,
            granted_by TEXT,
            is_active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(group_id, permission_id),
            FOREIGN KEY(group_id) REFERENCES user_groups(id) ON DELETE CASCADE,
            FOREIGN KEY(permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
            FOREIGN KEY(granted_by) REFERENCES users(username)
        )`,
        `CREATE TABLE IF NOT EXISTS audit_trail (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId TEXT,
            action TEXT NOT NULL,
            resource_type TEXT,
            resource_id TEXT,
            old_values TEXT,
            new_values TEXT,
            ip_address TEXT,
            user_agent TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(userId) REFERENCES users(username)
        )`,
        `CREATE TABLE IF NOT EXISTS content_schedule (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            videoId INTEGER,
            publish_at DATETIME NOT NULL,
            action_type TEXT DEFAULT 'publish',
            scheduled_by TEXT,
            description TEXT,
            status TEXT DEFAULT 'pending',
            executed_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(videoId) REFERENCES videos(id),
            FOREIGN KEY(scheduled_by) REFERENCES users(username)
        )`,
        `CREATE TABLE IF NOT EXISTS password_policies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            min_length INTEGER DEFAULT 8,
            require_uppercase BOOLEAN DEFAULT 1,
            require_lowercase BOOLEAN DEFAULT 1,
            require_numbers BOOLEAN DEFAULT 1,
            require_special_chars BOOLEAN DEFAULT 1,
            max_age_days INTEGER DEFAULT 90,
            history_count INTEGER DEFAULT 5,
            lockout_attempts INTEGER DEFAULT 5,
            lockout_duration_minutes INTEGER DEFAULT 30,
            is_active BOOLEAN DEFAULT 0,
            created_by TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(created_by) REFERENCES users(username)
        )`
    ];

    tables.forEach((table) => {
        db.run(table, (err) => {
            if (err) {
                console.error('Error creating table:', err.message);
            }
        });
    });

    // Insert default data
    seedDatabase();
}

// Seed database with initial data
async function seedDatabase() {
    // Create default admin user
    const adminPassword = await bcrypt.hash('123456', 10);
    const userPassword = await bcrypt.hash('123456', 10);

    db.run(`INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)`,
           ['admin', adminPassword, 'admin']);
    db.run(`INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)`,
           ['user', userPassword, 'user']);

    // Create default categories
    const categories = ['Development', 'Design', 'Marketing'];
    categories.forEach(category => {
        db.run(`INSERT OR IGNORE INTO categories (name) VALUES (?)`, [category]);
    });

    // Create default videos
    const videos = [
        {
            title: 'Introduction to Web Development',
            description: 'An introductory course to web development fundamentals, covering HTML, CSS, and JavaScript.',
            thumbnailUrl: 'https://placehold.co/400x225/2a9d8f/c9d1d9?text=WebDev',
            videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            views: 1500,
            isFeatured: 1,
            categoryId: 1
        },
        {
            title: 'Getting Started with UI/UX Design',
            description: 'Learn the basics of user interface and user experience design.',
            thumbnailUrl: 'https://placehold.co/400x225/e9c46a/264653?text=UI/UX',
            videoUrl: 'https://www.youtube.com/watch?v=S01mP-mR8Ew',
            views: 800,
            isFeatured: 0,
            categoryId: 2
        },
        {
            title: 'The Power of Digital Marketing',
            description: 'A guide to digital marketing strategies and tools for your business.',
            thumbnailUrl: 'https://placehold.co/400x225/f4a261/264653?text=Marketing',
            videoUrl: 'https://www.youtube.com/watch?v=N_x011_x-wU',
            views: 1200,
            isFeatured: 0,
            categoryId: 3
        },
        {
            title: 'JavaScript Advanced Concepts',
            description: 'Deep dive into advanced topics in JavaScript programming language.',
            thumbnailUrl: 'https://placehold.co/400x225/e76f51/264653?text=JS+Advanced',
            videoUrl: 'https://www.youtube.com/watch?v=XF-gqK7yB1A',
            views: 2500,
            isFeatured: 0,
            categoryId: 1
        },
        {
            title: 'Introduction to Figma',
            description: 'Master the basics of Figma, a powerful tool for collaborative design.',
            thumbnailUrl: 'https://placehold.co/400x225/264653/e9c46a?text=Figma',
            videoUrl: 'https://www.youtube.com/watch?v=Ft7L7X7N-6o',
            views: 600,
            isFeatured: 0,
            categoryId: 2
        }
    ];

    videos.forEach(video => {
        db.run(`INSERT OR IGNORE INTO videos (title, description, thumbnailUrl, videoUrl, views, isFeatured, categoryId) VALUES (?, ?, ?, ?, ?, ?, ?)`,
               [video.title, video.description, video.thumbnailUrl, video.videoUrl, video.views, video.isFeatured, video.categoryId]);
    });

    // Create default settings
    db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`, ['siteName', 'VisionHub']);
    db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`, ['primaryColor', '#2a9d8f']);
}

// Authentication middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

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

// Logging function
function logAction(userId, action, details = '') {
    db.run(`INSERT INTO logs (userId, action, details) VALUES (?, ?, ?)`,
           [userId, action, details],
           (err) => {
               if (err) console.error('Error logging action:', err.message);
           });
}

// Initialize the application
if (require.main === module) {
    initializeApp();
}