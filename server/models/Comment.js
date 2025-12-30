class Comment {
    static async getByVideoId(db, videoId) {
        return await db.all(`
            SELECT * FROM comments
            WHERE videoId = ?
            ORDER BY created_at DESC
        `, [videoId]);
    }

    static async create(db, commentData) {
        return await db.run(
            'INSERT INTO comments (videoId, userId, text) VALUES (?, ?, ?)',
            [commentData.videoId, commentData.userId, commentData.text]
        );
    }

    static async delete(db, id) {
        return await db.run('DELETE FROM comments WHERE id = ?', [id]);
    }
}

module.exports = Comment;