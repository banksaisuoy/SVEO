const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();

const dbPath = process.env.NODE_ENV === 'test' ? ':memory:' : './database.sqlite';

const dbInstance = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else if (process.env.NODE_ENV !== 'test') {
        console.log('Connected to the SQLite database.');
    }
});

function createTables() {
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

    let encounteredError = null;

    queries.forEach((query) => {
        dbInstance.run(query, (err) => {
            if (err) {
                encounteredError = encounteredError || err;
                console.error('DB Init Error:', err.message);
            }
        });
    });

    return encounteredError;
}

function seedDefaultAdmin(callback) {
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'password';

    dbInstance.get('SELECT * FROM users WHERE username = ?', [adminUsername], (err, row) => {
        if (err) {
            if (callback) callback(err);
            return;
        }

        if (row) {
            if (callback) callback(null);
            return;
        }

        bcrypt.hash(adminPassword, 10, (hashErr, hash) => {
            if (hashErr) {
                if (callback) callback(hashErr);
                return;
            }

            dbInstance.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [adminUsername, hash, 'admin'], (insertErr) => {
                if (!insertErr && process.env.NODE_ENV !== 'test') {
                    console.log('Default admin user created.');
                }
                if (callback) callback(insertErr || null);
            });
        });
    });
}

function initializeDb(callback) {
    dbInstance.serialize(() => {
        const tableError = createTables();
        if (tableError) {
            if (callback) callback(tableError);
            return;
        }

        seedDefaultAdmin((err) => {
            if (callback) callback(err || null);
        });
    });
}

module.exports = dbInstance;
module.exports.db = dbInstance;
module.exports.initializeDb = initializeDb;
