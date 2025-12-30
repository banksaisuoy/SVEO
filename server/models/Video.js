class Video {
    static async getAll(db) {
        return await db.all(`
            SELECT v.*, c.name as categoryName
            FROM videos v
            LEFT JOIN categories c ON v.categoryId = c.id
            ORDER BY v.created_at DESC
        `);
    }

    static async getById(db, id) {
        return await db.get(`
            SELECT v.*, c.name as categoryName
            FROM videos v
            LEFT JOIN categories c ON v.categoryId = c.id
            WHERE v.id = ?
        `, [id]);
    }

    static async getFeatured(db) {
        return await db.all(`
            SELECT v.*, c.name as categoryName
            FROM videos v
            LEFT JOIN categories c ON v.categoryId = c.id
            WHERE v.isFeatured = 1
            ORDER BY v.created_at DESC
        `);
    }

    static async getTrending(db, limit = 4) {
        return await db.all(`
            SELECT v.*, c.name as categoryName
            FROM videos v
            LEFT JOIN categories c ON v.categoryId = c.id
            ORDER BY v.views DESC
            LIMIT ?
        `, [limit]);
    }

    static async search(db, query) {
        const searchTerm = `%${query}%`;
        return await db.all(`
            SELECT v.*, c.name as categoryName
            FROM videos v
            LEFT JOIN categories c ON v.categoryId = c.id
            WHERE v.title LIKE ? OR v.description LIKE ? OR c.name LIKE ?
            ORDER BY v.created_at DESC
        `, [searchTerm, searchTerm, searchTerm]);
    }

    static async create(db, videoData) {
        const result = await db.run(`
            INSERT INTO videos (title, description, thumbnailUrl, videoUrl, categoryId, isFeatured)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [
            videoData.title,
            videoData.description,
            videoData.thumbnailUrl,
            videoData.videoUrl,
            videoData.categoryId,
            videoData.isFeatured ? 1 : 0
        ]);
        return { id: result.id };
    }

    static async update(db, id, videoData) {
        const result = await db.run(`
            UPDATE videos
            SET title = ?, description = ?, thumbnailUrl = ?, videoUrl = ?, categoryId = ?, isFeatured = ?
            WHERE id = ?
        `, [
            videoData.title,
            videoData.description,
            videoData.thumbnailUrl,
            videoData.videoUrl,
            videoData.categoryId,
            videoData.isFeatured ? 1 : 0,
            id
        ]);
        return { changes: result.changes };
    }

    static async delete(db, id) {
        return await db.run('DELETE FROM videos WHERE id = ?', [id]);
    }

    static async incrementViews(db, id) {
        return await db.run('UPDATE videos SET views = views + 1 WHERE id = ?', [id]);
    }
}

module.exports = Video;