class Playlist {
    static async getUserPlaylists(db, userId) {
        return await db.all(`
            SELECT p.*, COUNT(pv.video_id) as video_count
            FROM playlists p
            LEFT JOIN playlist_videos pv ON p.id = pv.playlist_id
            WHERE p.userId = ? AND p.is_active = 1
            GROUP BY p.id
            ORDER BY p.updated_at DESC
        `, [userId]);
    }

    static async getById(db, id) {
        return await db.get('SELECT * FROM playlists WHERE id = ? AND is_active = 1', [id]);
    }

    static async create(db, playlistData) {
        return await db.run(
            'INSERT INTO playlists (name, description, userId, is_public) VALUES (?, ?, ?, ?)',
            [playlistData.name, playlistData.description || '', playlistData.userId, playlistData.is_public ? 1 : 0]
        );
    }

    static async update(db, id, playlistData) {
        return await db.run(
            'UPDATE playlists SET name = ?, description = ?, is_public = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [playlistData.name, playlistData.description || '', playlistData.is_public ? 1 : 0, id]
        );
    }

    static async delete(db, id) {
        return await db.run('UPDATE playlists SET is_active = 0 WHERE id = ?', [id]);
    }

    static async getVideos(db, playlistId) {
        return await db.all(`
            SELECT v.*, c.name as categoryName, pv.position, pv.added_at
            FROM videos v
            LEFT JOIN categories c ON v.categoryId = c.id
            INNER JOIN playlist_videos pv ON v.id = pv.video_id
            WHERE pv.playlist_id = ?
            ORDER BY pv.position, pv.added_at
        `, [playlistId]);
    }

    static async addVideo(db, playlistId, videoId, position = null) {
        if (position === null) {
            const result = await db.get(
                'SELECT COALESCE(MAX(position), 0) + 1 as nextPosition FROM playlist_videos WHERE playlist_id = ?',
                [playlistId]
            );
            position = result.nextPosition;
        }

        return await db.run(
            'INSERT OR REPLACE INTO playlist_videos (playlist_id, video_id, position) VALUES (?, ?, ?)',
            [playlistId, videoId, position]
        );
    }

    static async removeVideo(db, playlistId, videoId) {
        return await db.run(
            'DELETE FROM playlist_videos WHERE playlist_id = ? AND video_id = ?',
            [playlistId, videoId]
        );
    }

    static async reorderVideos(db, playlistId, videoOrders) {
        const promises = videoOrders.map(({ videoId, position }) =>
            db.run(
                'UPDATE playlist_videos SET position = ? WHERE playlist_id = ? AND video_id = ?',
                [position, playlistId, videoId]
            )
        );
        return Promise.all(promises);
    }
}

module.exports = Playlist;