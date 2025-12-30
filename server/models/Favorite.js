class Favorite {
    static async getUserFavorites(db, userId) {
        return await db.all(`
            SELECT v.*, c.name as categoryName
            FROM videos v
            LEFT JOIN categories c ON v.categoryId = c.id
            INNER JOIN user_favorites uf ON v.id = uf.videoId
            WHERE uf.userId = ?
            ORDER BY uf.created_at DESC
        `, [userId]);
    }

    static async isFavorited(db, userId, videoId) {
        const result = await db.get(
            'SELECT COUNT(*) as count FROM user_favorites WHERE userId = ? AND videoId = ?',
            [userId, videoId]
        );
        return result.count > 0;
    }

    static async add(db, userId, videoId) {
        return await db.run(
            'INSERT OR IGNORE INTO user_favorites (userId, videoId) VALUES (?, ?)',
            [userId, videoId]
        );
    }

    static async remove(db, userId, videoId) {
        return await db.run(
            'DELETE FROM user_favorites WHERE userId = ? AND videoId = ?',
            [userId, videoId]
        );
    }
}

module.exports = Favorite;