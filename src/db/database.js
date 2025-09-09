const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

// Use an in-memory database for simplicity, or change to a file path
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initializeDb();
    }
});

function initializeDb() {
    db.serialize(() => {
        // Original tables
        db.run(`CREATE TABLE IF NOT EXISTS videos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            url TEXT NOT NULL,
            thumbnail_url TEXT,
            category TEXT,
            upload_date TEXT
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
        )`);

        // New tables for users, roles, and permissions
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user', 'admin'))
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS video_tags (
            video_id INTEGER,
            tag_id INTEGER,
            PRIMARY KEY (video_id, tag_id),
            FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
            FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS user_tag_permissions (
            user_id INTEGER,
            tag_id INTEGER,
            PRIMARY KEY (user_id, tag_id),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
        )`);

        // New tables for logging
        db.run(`CREATE TABLE IF NOT EXISTS login_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS view_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            video_id INTEGER,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
        )`);

        // Create a default admin user if it doesn't exist
        const adminUsername = process.env.ADMIN_USERNAME || 'admin';
        const adminPassword = process.env.ADMIN_PASSWORD || 'password';

        db.get('SELECT * FROM users WHERE username = ?', [adminUsername], (err, row) => {
            if (err) {
                console.error('Error checking for admin user:', err.message);
                return;
            }
            if (!row) {
                bcrypt.hash(adminPassword, 10, (err, hash) => {
                    if (err) {
                        console.error('Error hashing password:', err.message);
                        return;
                    }
                    db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [adminUsername, hash, 'admin'], (err) => {
                        if (err) {
                            console.error('Error creating admin user:', err.message);
                        } else {
                            console.log('Default admin user created.');
                        }
                    });
                });
            }
        });
    });
}

module.exports = db;
