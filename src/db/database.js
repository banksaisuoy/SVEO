const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

const dbPath = process.env.NODE_ENV === 'test' ? ':memory:' : './database.sqlite';

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        if (process.env.NODE_ENV !== 'test') {
            console.log('Connected to the main SQLite database.');
            initializeDb();
        } else {
            console.log('Connected to in-memory SQLite database for testing.');
        }
    }
});

function initializeDb(callback) {
    db.serialize(() => {
        // Table creation queries
        const queries = [
            `CREATE TABLE IF NOT EXISTS videos (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT, url TEXT NOT NULL, thumbnail_url TEXT, category TEXT, upload_date TEXT)`,
            `CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE)`,
            `CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user', 'admin')))`,
            `CREATE TABLE IF NOT EXISTS tags (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE)`,
            `CREATE TABLE IF NOT EXISTS video_tags (video_id INTEGER, tag_id INTEGER, PRIMARY KEY (video_id, tag_id), FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE, FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE)`,
            `CREATE TABLE IF NOT EXISTS user_tag_permissions (user_id INTEGER, tag_id INTEGER, PRIMARY KEY (user_id, tag_id), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE)`,
            `CREATE TABLE IF NOT EXISTS login_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)`,
            `CREATE TABLE IF NOT EXISTS view_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, video_id INTEGER, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE)`
        ];

        queries.forEach(query => db.run(query, (err) => {
            if (err) console.error("DB Init Error:", err.message);
        }));

        // Seed admin user
        const adminUsername = process.env.ADMIN_USERNAME || 'admin';
        const adminPassword = process.env.ADMIN_PASSWORD || 'password';

        db.get('SELECT * FROM users WHERE username = ?', [adminUsername], (err, row) => {
            if (err) return callback ? callback(err) : console.error(err.message);
            if (!row) {
                bcrypt.hash(adminPassword, 10, (err, hash) => {
                    if (err) return callback ? callback(err) : console.error(err.message);

                    db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [adminUsername, hash, 'admin'], (err) => {
                        if (!err) console.log('Default admin user created.');
                        if (callback) callback(err);
                    });
                });
            } else {
                if (callback) callback();
            }
        });
    });
}

// Export the db instance and the initializer
module.exports = { db, initializeDb };
