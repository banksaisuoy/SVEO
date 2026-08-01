module.exports = (db) => {
    db.serialize(() => {
        // Create the categories table if it doesn't exist
        db.run(`CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
        )`, (err) => {
            if (err) {
                console.error('Error creating categories table:', err.message);
            }
        });

        // Create the videos table if it doesn't exist
        db.run(`CREATE TABLE IF NOT EXISTS videos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            category TEXT,
            category_id INTEGER,
            file_path TEXT,
            thumbnail_path TEXT,
            duration INTEGER,
            created_at TEXT,
            updated_at TEXT
        )`, (err) => {
            if (err) {
                console.error('Error creating videos table:', err.message);
            }
        });

        // Add columns if they do not exist (migration for existing database)
        db.all(`PRAGMA table_info(videos)`, [], (err, cols) => {
            if (err) {
                console.error('PRAGMA error on videos:', err.message);
                return;
            }
            try {
                const names = (cols || []).map(c => c.name);
                const addColumn = (colName, colType) => {
                    if (!names.includes(colName)) {
                        db.run(`ALTER TABLE videos ADD COLUMN ${colName} ${colType}`, (e) => {
                            if (e) console.error(`Failed to add ${colName} column:`, e.message);
                            else console.log(`Migrated: added ${colName} column to videos`);
                        });
                    }
                };

                addColumn('category_id', 'INTEGER');
                addColumn('file_path', 'TEXT');
                addColumn('thumbnail_path', 'TEXT');
                addColumn('duration', 'INTEGER');
                addColumn('created_at', 'TEXT');
                addColumn('updated_at', 'TEXT');
            } catch (e) {
                console.error('Migration error on videos:', e);
            }
        });
    });
};