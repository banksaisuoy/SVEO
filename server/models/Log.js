class Log {
    static async getRecent(db, limit = 100) {
        return await db.all(
            'SELECT * FROM logs ORDER BY created_at DESC LIMIT ?',
            [limit]
        );
    }

    static async create(db, userId, action, details = '') {
        return await db.run(
            'INSERT INTO logs (userId, action, details) VALUES (?, ?, ?)',
            [userId, action, details]
        );
    }
}

module.exports = Log;