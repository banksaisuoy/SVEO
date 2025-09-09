const db = require('../db/database');

// GET all videos, with tag permissions for users
exports.getAllVideos = (req, res) => {
    const user = req.session.user;
    let sql;
    let params = [];

    // The main query to get videos and aggregate their tags
    const baseQuery = `
        SELECT
            v.*,
            (SELECT GROUP_CONCAT(t.name) FROM tags t JOIN video_tags vt ON t.id = vt.tag_id WHERE vt.video_id = v.id) as tags
        FROM videos v
    `;

    if (user && user.role === 'user') {
        // For standard users, get videos matching their permitted tags
        sql = `
            ${baseQuery}
            WHERE EXISTS (
                SELECT 1
                FROM video_tags vt
                JOIN user_tag_permissions utp ON vt.tag_id = utp.tag_id
                WHERE vt.video_id = v.id AND utp.user_id = ?
            )
            ORDER BY v.upload_date DESC
        `;
        params.push(user.id);
    } else {
        // For admins or public, get all videos
        sql = `${baseQuery} ORDER BY v.upload_date DESC`;
    }

    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error('Error fetching videos:', err.message);
            return res.status(500).json({ error: 'Failed to fetch videos.' });
        }
        // Log view event for each video fetched by a logged-in user
        if (user && rows) {
            const stmt = db.prepare('INSERT INTO view_logs (user_id, video_id) VALUES (?, ?)');
            rows.forEach(video => {
                stmt.run(user.id, video.id);
            });
            stmt.finalize();
        }
        res.status(200).json(rows);
    });
};

// POST a new video from an uploaded file
exports.uploadVideo = (req, res) => {
    const { title, description, category, tagIds } = req.body;
    const url = `/uploads/videos/${req.file.filename}`; // Path to the uploaded file

    if (!title || !req.file) {
        return res.status(400).json({ error: 'Title and video file are required.' });
    }

    const upload_date = new Date().toISOString();
    // Thumbnail can be generated later or uploaded separately. For now, it's null.
    const thumbnail_url = null;
    const videoSql = `INSERT INTO videos (title, description, url, thumbnail_url, category, upload_date) VALUES (?, ?, ?, ?, ?, ?)`;
    const videoParams = [title, description, url, thumbnail_url, category, upload_date];

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        db.run(videoSql, videoParams, function(err) {
            if (err) {
                console.error('Error adding uploaded video:', err.message);
                db.run('ROLLBACK');
                return res.status(500).json({ error: 'Failed to add uploaded video.' });
            }

            const videoId = this.lastID;
            // The tagIds will be a string if coming from multipart/form-data, parse it
            const parsedTagIds = typeof tagIds === 'string' ? JSON.parse(tagIds) : tagIds;

            if (parsedTagIds && parsedTagIds.length > 0) {
                const tagSql = 'INSERT INTO video_tags (video_id, tag_id) VALUES (?, ?)';
                const stmt = db.prepare(tagSql);
                parsedTagIds.forEach(tagId => {
                    stmt.run(videoId, tagId);
                });

                stmt.finalize((err) => {
                    if (err) {
                        console.error('Error adding video tag from upload:', err.message);
                        db.run('ROLLBACK');
                        return res.status(500).json({ error: 'Failed to associate tags with uploaded video.' });
                    }
                    db.run('COMMIT');
                    res.status(201).json({ id: videoId, title, url, message: 'Video uploaded and saved successfully.' });
                });
            } else {
                db.run('COMMIT');
                res.status(201).json({ id: videoId, title, url, message: 'Video uploaded and saved successfully.' });
            }
        });
    });
};

// POST a new video, with tags
exports.createVideo = (req, res) => {
    const { title, description, url, thumbnail_url, category, tagIds } = req.body;
    if (!title || !url) {
        return res.status(400).json({ error: 'Title and URL are required.' });
    }

    const upload_date = new Date().toISOString();
    const videoSql = `INSERT INTO videos (title, description, url, thumbnail_url, category, upload_date) VALUES (?, ?, ?, ?, ?, ?)`;
    const videoParams = [title, description, url, thumbnail_url, category, upload_date];

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        db.run(videoSql, videoParams, function(err) {
            if (err) {
                console.error('Error adding video:', err.message);
                db.run('ROLLBACK');
                return res.status(500).json({ error: 'Failed to add video.' });
            }

            const videoId = this.lastID;
            if (tagIds && tagIds.length > 0) {
                const tagSql = 'INSERT INTO video_tags (video_id, tag_id) VALUES (?, ?)';
                const stmt = db.prepare(tagSql);
                tagIds.forEach(tagId => {
                    stmt.run(videoId, tagId, (err) => {
                        if (err) {
                            // This error will be caught by the final callback of the finalize method
                            console.error('Error adding video tag:', err.message);
                        }
                    });
                });

                stmt.finalize((err) => {
                    if (err) {
                        console.error('Error finalizing video tag insertions:', err.message);
                        db.run('ROLLBACK');
                        return res.status(500).json({ error: 'Failed to associate tags with video.' });
                    }
                    db.run('COMMIT');
                    res.status(201).json({ id: videoId, title, url, message: 'Video and tags added successfully.' });
                });
            } else {
                // No tags to add, just commit
                db.run('COMMIT');
                res.status(201).json({ id: videoId, title, url, message: 'Video added successfully.' });
            }
        });
    });
};


// DELETE a video
exports.deleteVideo = (req, res) => {
    const { id } = req.params;
    // The ON DELETE CASCADE constraint on video_tags will handle removing associations
    const sql = `DELETE FROM videos WHERE id = ?`;
    db.run(sql, id, function(err) {
        if (err) {
            console.error('Error deleting video:', err.message);
            return res.status(500).json({ error: 'Failed to delete video.' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Video not found.' });
        }
        res.status(200).json({ message: 'Video deleted successfully.' });
    });
};
