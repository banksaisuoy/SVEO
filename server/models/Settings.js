class Settings {
    static async getAll(db) {
        return await db.all('SELECT * FROM settings');
    }

    static async get(db, key) {
        return await db.get('SELECT value FROM settings WHERE key = ?', [key]);
    }

    static async set(db, key, value) {
        return await db.run(
            'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
            [key, value]
        );
    }
}

module.exports = Settings;