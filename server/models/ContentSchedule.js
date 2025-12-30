class ContentSchedule {
    static async getAll(db) {
        return await db.all(`
            SELECT cs.*, v.title as videoTitle, u.username as scheduled_by_name
            FROM content_schedule cs
            LEFT JOIN videos v ON cs.video_id = v.id
            LEFT JOIN users u ON cs.created_by = u.username
            ORDER BY cs.published_at ASC
        `);
    }

    static async getPending(db) {
        return await db.all(`
            SELECT cs.*, v.title as videoTitle
            FROM content_schedule cs
            LEFT JOIN videos v ON cs.video_id = v.id
            WHERE cs.status = 'scheduled' AND cs.published_at <= CURRENT_TIMESTAMP
            ORDER BY cs.published_at ASC
        `);
    }

    static async create(db, scheduleData) {
        return await db.run(
            'INSERT INTO content_schedule (video_id, published_at, action_type, created_by, description) VALUES (?, ?, ?, ?, ?)',
            [scheduleData.videoId, scheduleData.publish_at, scheduleData.action_type || 'publish', scheduleData.scheduled_by, scheduleData.description || '']
        );
    }

    static async update(db, id, scheduleData) {
        return await db.run(
            'UPDATE content_schedule SET published_at = ?, action_type = ?, description = ?, status = ? WHERE id = ?',
            [scheduleData.publish_at, scheduleData.action_type, scheduleData.description, scheduleData.status, id]
        );
    }

    static async execute(db, id) {
        return await db.run(
            'UPDATE content_schedule SET status = "published", published_at = CURRENT_TIMESTAMP WHERE id = ?',
            [id]
        );
    }

    static async cancel(db, id) {
        return await db.run(
            'UPDATE content_schedule SET status = "cancelled" WHERE id = ?',
            [id]
        );
    }
}

module.exports = ContentSchedule;