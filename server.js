// Load environment variables from .env file
require('dotenv').config({ path: '.env' });

// Import required modules
const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const app = express();
const port = 3000;

// Middleware setup
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Enable JSON body parsing

// Use express-session middleware
app.use(session({
    secret: 'sveo-secret-key', // Use a strong, secret key for signing the session ID cookie
    resave: false, // Don't save the session if it wasn't modified
    saveUninitialized: false, // Don't create session until something is stored
    cookie: { secure: false } // Set to true if using HTTPS
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
    }
});

// Admin credentials from environment variables
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password';

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
        if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
            req.session.isAuthenticated = true;
            res.status(200).json({ success: true, message: 'Login successful' });
        } else {
            res.status(401).json({ error: 'Invalid username or password' });
        }
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
    res.status(200).json({ isAuthenticated: req.session.isAuthenticated || false });
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
app.post('/api/videos', isAuthenticated, (req, res) => {
    const { title, description, url, thumbnail_url, category } = req.body;
    if (!title || !url) {
        return res.status(400).json({ error: 'Title and URL are required.' });
    }
    const upload_date = new Date().toISOString();
    const sql = `INSERT INTO videos (title, description, url, thumbnail_url, category, upload_date) VALUES (?, ?, ?, ?, ?, ?)`;
    db.run(sql, [title, description, url, thumbnail_url, category, upload_date], function(err) {
        if (err) {
            console.error('Error adding video:', err.message);
            return res.status(500).json({ error: 'Failed to add video.' });
        }
        res.status(201).json({ id: this.lastID, title, url, message: 'Video added successfully.' });
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
