class Tag {
    static async getAll(db) {
        return await db.all('SELECT * FROM tags ORDER BY name');
    }

    static async getById(db, id) {
        return await db.get('SELECT * FROM tags WHERE id = ?', [id]);
    }

    static async create(db, tagData) {
        return await db.run(
            'INSERT INTO tags (name, description, color) VALUES (?, ?, ?)',
            [tagData.name, tagData.description || '', tagData.color || '#2563eb']
        );
    }

    static async update(db, id, tagData) {
        return await db.run(
            'UPDATE tags SET name = ?, description = ?, color = ? WHERE id = ?',
            [tagData.name, tagData.description || '', tagData.color || '#2563eb', id]
        );
    }

    static async delete(db, id) {
        // Remove tag from all videos first
        await db.run('DELETE FROM video_tags WHERE tag_id = ?', [id]);
        // Delete the tag
        return await db.run('DELETE FROM tags WHERE id = ?', [id]);
    }

    static async getVideoTags(db, videoId) {
        return await db.all(`
            SELECT t.* FROM tags t
            INNER JOIN video_tags vt ON t.id = vt.tag_id
            WHERE vt.video_id = ?
            ORDER BY t.name
        `, [videoId]);
    }

    static async addToVideo(db, videoId, tagId) {
        return await db.run(
            'INSERT OR IGNORE INTO video_tags (video_id, tag_id) VALUES (?, ?)',
            [videoId, tagId]
        );
    }

    static async removeFromVideo(db, videoId, tagId) {
        return await db.run(
            'DELETE FROM video_tags WHERE video_id = ? AND tag_id = ?',
            [videoId, tagId]
        );
    }

    static async searchVideos(db, tagNames) {
        const placeholders = tagNames.map(() => '?').join(',');
        return await db.all(`
            SELECT DISTINCT v.*, c.name as categoryName,
                   GROUP_CONCAT(t.name) as tagNames
            FROM videos v
            LEFT JOIN categories c ON v.categoryId = c.id
            INNER JOIN video_tags vt ON v.id = vt.video_id
            INNER JOIN tags t ON vt.tag_id = t.id
            WHERE t.name IN (${placeholders}) OR t.id IN (${placeholders})
            GROUP BY v.id
            ORDER BY v.created_at DESC
        `, [...tagNames, ...tagNames]);
    }
}

module.exports = Tag;