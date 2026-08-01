const express = require('express');
const helmet = require('helmet');
const fs = require('fs');
const path = require('path');

module.exports = (db, upload, isAdmin, isAuthenticated) => {
    const router = express.Router();
    
    // Add helmet middleware for security on these admin routes
    router.use(helmet());

    // POST a new video (Admin only)
    router.post('/videos', isAuthenticated, isAdmin, upload.fields([{ name: 'video', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }]), (req, res) => {
        let { title, description, category } = req.body;
        
        if (!title) {
            return res.status(400).json({ error: 'Title is required.' });
        }
        if (!req.files || !req.files['video']) {
            return res.status(400).json({ error: 'Video file is required.' });
        }

        // Sanitize inputs basic
        title = title ? title.trim().replace(/</g, "&lt;").replace(/>/g, "&gt;") : '';
        description = description ? description.trim().replace(/</g, "&lt;").replace(/>/g, "&gt;") : '';
        category = category ? category.trim().replace(/</g, "&lt;").replace(/>/g, "&gt;") : '';

        // Check if category exists
        db.get(`SELECT id FROM categories WHERE name = ?`, [category], (err, row) => {
            if (err) {
                console.error('Error fetching category:', err.message);
                return res.status(500).json({ error: 'Database error while checking category.' });
            }
            if (!row && category) {
                return res.status(400).json({ error: `Category '${category}' does not exist.` });
            }

            const video_url = `/uploads/videos/${req.files['video'][0].filename}`;
            const thumbnail_url = req.files['thumbnail'] ? `/uploads/videos/${req.files['thumbnail'][0].filename}` : '';
            const created_at = new Date().toISOString();
            const updated_at = created_at;

            const sql = `INSERT INTO videos (title, description, category, video_url, thumbnail_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`;
            db.run(sql, [title, description, category, video_url, thumbnail_url, created_at, updated_at], function(err) {
                if (err) {
                    console.error('Error adding video:', err.message);
                    return res.status(500).json({ error: 'Failed to add video.' });
                }
                res.status(201).json({ 
                    id: this.lastID, 
                    title, 
                    description,
                    category,
                    video_url,
                    thumbnail_url,
                    message: 'Video added successfully.' 
                });
            });
        });
    });


    // GET all videos (Admin)
    router.get('/videos', isAuthenticated, isAdmin, (req, res) => {
        db.all(`SELECT id, title, description, category, video_url, thumbnail_url, created_at, updated_at FROM videos ORDER BY created_at DESC`, [], (err, rows) => {
            if (err) {
                console.error('Error fetching videos:', err.message);
                return res.status(500).json({ error: 'Failed to fetch videos.' });
            }
            res.status(200).json(rows);
        });
    });

    // PUT update video metadata and optionally files (Admin only)
    router.put('/videos/:id', isAuthenticated, isAdmin, upload.fields([{ name: 'video', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }]), (req, res) => {
        const { id } = req.params;
        let { title, description, category } = req.body;
        
        if (!title) {
            return res.status(400).json({ error: 'Title is required.' });
        }

        // Sanitize inputs basic
        title = title ? title.trim().replace(/</g, "&lt;").replace(/>/g, "&gt;") : '';
        description = description ? description.trim().replace(/</g, "&lt;").replace(/>/g, "&gt;") : '';
        category = category ? category.trim().replace(/</g, "&lt;").replace(/>/g, "&gt;") : '';

        // Check category
        db.get(`SELECT id FROM categories WHERE name = ?`, [category], (err, row) => {
            if (err) return res.status(500).json({ error: 'Database error while checking category.' });
            if (!row && category) return res.status(400).json({ error: `Category '${category}' does not exist.` });

            // Get existing record to know what to delete
            db.get(`SELECT video_url, thumbnail_url FROM videos WHERE id = ?`, [id], (fetchErr, videoRow) => {
                if (fetchErr) return res.status(500).json({ error: 'Database error fetching video.' });
                if (!videoRow) return res.status(404).json({ error: 'Video not found.' });

                const updated_at = new Date().toISOString();
                
                let newVideoUrl = videoRow.video_url;
                let newThumbnailUrl = videoRow.thumbnail_url;

                const filesToDelete = [];

                if (req.files && req.files['video']) {
                    newVideoUrl = `/uploads/videos/${req.files['video'][0].filename}`;
                    if (videoRow.video_url && videoRow.video_url.startsWith('/uploads')) {
                        filesToDelete.push(path.join(__dirname, '..', 'public', videoRow.video_url));
                    }
                }
                
                if (req.files && req.files['thumbnail']) {
                    newThumbnailUrl = `/uploads/videos/${req.files['thumbnail'][0].filename}`;
                    if (videoRow.thumbnail_url && videoRow.thumbnail_url.startsWith('/uploads')) {
                        filesToDelete.push(path.join(__dirname, '..', 'public', videoRow.thumbnail_url));
                    }
                }

                const sql = `UPDATE videos SET title = ?, description = ?, category = ?, video_url = ?, thumbnail_url = ?, updated_at = ? WHERE id = ?`;
                db.run(sql, [title, description, category, newVideoUrl, newThumbnailUrl, updated_at, id], function(updateErr) {
                    if (updateErr) return res.status(500).json({ error: 'Failed to update video.' });
                    
                    // delete old files
                    filesToDelete.forEach(filePath => {
                        fs.unlink(filePath, (unlinkErr) => {
                            if (unlinkErr && unlinkErr.code !== 'ENOENT') console.error('Error deleting file:', unlinkErr.message);
                        });
                    });

                    res.status(200).json({ message: 'Video updated successfully.', id, video_url: newVideoUrl, thumbnail_url: newThumbnailUrl });
                });
            });
        });
    });

    // DELETE a video (Admin only)
    router.delete('/videos/:id', isAuthenticated, isAdmin, (req, res) => {
        const { id } = req.params;

        db.get(`SELECT video_url, thumbnail_url FROM videos WHERE id = ?`, [id], (err, row) => {
            if (err) return res.status(500).json({ error: 'Failed to fetch video details.' });
            if (!row) return res.status(404).json({ error: 'Video not found.' });

            db.run(`DELETE FROM videos WHERE id = ?`, [id], function(delErr) {
                if (delErr) return res.status(500).json({ error: 'Failed to delete video.' });

                const filesToDelete = [];
                if (row.video_url && row.video_url.startsWith('/uploads')) filesToDelete.push(path.join(__dirname, '..', 'public', row.video_url));
                if (row.thumbnail_url && row.thumbnail_url.startsWith('/uploads')) filesToDelete.push(path.join(__dirname, '..', 'public', row.thumbnail_url));

                filesToDelete.forEach(filePath => {
                    fs.unlink(filePath, (unlinkErr) => {
                        if (unlinkErr && unlinkErr.code !== 'ENOENT') console.error('Error deleting file:', unlinkErr.message);
                    });
                });

                res.status(200).json({ message: 'Video deleted successfully.' });
            });
        });
    });

    return router;
};