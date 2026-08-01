const express = require('express');
const fs = require('fs');
const path = require('path');

module.exports = (db, upload, isAdmin) => {
    const router = express.Router();

    // GET all videos (with optional category and search query params)
    router.get('/', (req, res) => {
        let sql = `SELECT * FROM videos`;
        const params = [];
        const conditions = [];

        if (req.query.category) {
            // Using LIKE for category string matching or matching category_id depending on how it's stored.
            // Let's assume category filter can map to category_id or old category string
            conditions.push(`(category = ? OR category_id = ?)`);
            params.push(req.query.category, req.query.category);
        }
        if (req.query.search) {
            conditions.push(`(title LIKE ? OR description LIKE ?)`);
            const searchParam = `%${req.query.search}%`;
            params.push(searchParam, searchParam);
        }

        if (conditions.length > 0) {
            sql += ` WHERE ` + conditions.join(' AND ');
        }
        
        sql += ` ORDER BY created_at DESC`;

        db.all(sql, params, (err, rows) => {
            if (err) {
                console.error('Error fetching videos:', err.message);
                return res.status(500).json({ error: 'Failed to fetch videos.' });
            }
            res.status(200).json(rows);
        });
    });

    // GET single video
    router.get('/:id', (req, res) => {
        const { id } = req.params;
        db.get(`SELECT * FROM videos WHERE id = ?`, [id], (err, row) => {
            if (err) {
                console.error('Error fetching video:', err.message);
                return res.status(500).json({ error: 'Failed to fetch video.' });
            }
            if (!row) {
                return res.status(404).json({ error: 'Video not found.' });
            }
            res.status(200).json(row);
        });
    });

    // POST a new video (Admin only)
    router.post('/', isAdmin, upload.single('file'), (req, res) => {
        const { title, description, category_id, thumbnail_path, duration } = req.body;
        if (!title) return res.status(400).json({ error: 'Title is required.' });
        if (!req.file) return res.status(400).json({ error: 'Video file is required.' });

        const file_path = `/uploads/videos/${req.file.filename}`;
        const created_at = new Date().toISOString();
        const updated_at = created_at;

        const sql = `INSERT INTO videos (title, description, category_id, file_path, thumbnail_path, duration, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
        db.run(sql, [title, description || '', category_id || null, file_path, thumbnail_path || '', duration || null, created_at, updated_at], function(err) {
            if (err) {
                console.error('Error adding video:', err.message);
                return res.status(500).json({ error: 'Failed to add video.' });
            }
            res.status(201).json({ id: this.lastID, title, file_path, message: 'Video added successfully.' });
        });
    });

    // PUT update video metadata (Admin only)
    router.put('/:id', isAdmin, (req, res) => {
        const { id } = req.params;
        const { title, description, category_id, thumbnail_path, duration } = req.body;
        
        const updated_at = new Date().toISOString();
        const sql = `UPDATE videos SET title = ?, description = ?, category_id = ?, thumbnail_path = ?, duration = ?, updated_at = ? WHERE id = ?`;
        
        db.run(sql, [title, description, category_id, thumbnail_path, duration, updated_at, id], function(err) {
            if (err) {
                console.error('Error updating video:', err.message);
                return res.status(500).json({ error: 'Failed to update video.' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Video not found.' });
            }
            res.status(200).json({ message: 'Video metadata updated successfully.' });
        });
    });

    // DELETE a video (Admin only)
    router.delete('/:id', isAdmin, (req, res) => {
        const { id } = req.params;

        // First, fetch the video to get the file path so we can delete the file
        db.get(`SELECT file_path, url FROM videos WHERE id = ?`, [id], (err, row) => {
            if (err) {
                console.error('Error fetching video for deletion:', err.message);
                return res.status(500).json({ error: 'Failed to fetch video details.' });
            }
            if (!row) {
                return res.status(404).json({ error: 'Video not found.' });
            }

            const videoPath = row.file_path || (row.url && row.url.startsWith('/uploads') ? row.url : null);

            // Delete from database
            db.run(`DELETE FROM videos WHERE id = ?`, [id], function(delErr) {
                if (delErr) {
                    console.error('Error deleting video from DB:', delErr.message);
                    return res.status(500).json({ error: 'Failed to delete video.' });
                }

                // Delete file from disk if it exists
                if (videoPath) {
                    const absolutePath = path.join(__dirname, '..', 'public', videoPath);
                    fs.unlink(absolutePath, (unlinkErr) => {
                        if (unlinkErr && unlinkErr.code !== 'ENOENT') {
                            console.error('Error deleting file from disk:', unlinkErr.message);
                            // Don't fail the API request if the file was just missing
                        }
                    });
                }

                res.status(200).json({ message: 'Video deleted successfully.' });
            });
        });
    });

    return router;
};