class Report {
    static async getAll(db) {
        return await db.all(`
            SELECT r.*, v.title as videoTitle
            FROM reports r
            LEFT JOIN videos v ON r.videoId = v.id
            ORDER BY r.created_at DESC
        `);
    }

    static async create(db, reportData) {
        return await db.run(
            'INSERT INTO reports (userId, videoId, reason) VALUES (?, ?, ?)',
            [reportData.userId, reportData.videoId, reportData.reason]
        );
    }

    static async delete(db, id) {
        return await db.run('DELETE FROM reports WHERE id = ?', [id]);
    }
}

module.exports = Report;