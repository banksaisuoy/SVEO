const express = require('express');
const { body, validationResult } = require('express-validator');

module.exports = (db, upload, isAdmin, isAuthenticated) => {
    const router = express.Router();

    // GET all users (Admin only)
    router.get('/users', isAuthenticated, isAdmin, (req, res) => {
    });

    // PUT suspend/unsuspend a user (Admin only)
    router.put('/users/:id/suspend', 
        isAuthenticated, 
        isAdmin,
        [
            body('suspended').isBoolean().withMessage('Suspended status is required and must be a boolean.')
        ],
        (req, res) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ error: errors.array()[0].msg });
            }

            const { id } = req.params;
            const { suspended } = req.body;

            db.run(`UPDATE users SET suspended = ? WHERE id = ?`, [suspended ? 1 : 0, id], function(err) {
                if (err) {
                    console.error('Error updating user:', err.message);
                    return res.status(500).json({ error: 'Failed to update user.' });
                }
                if (this.changes === 0) {
                    return res.status(404).json({ error: 'User not found.' });
                }
                res.status(200).json({ message: 'User updated successfully.' });
            });
    });

    // DELETE a video (Admin only)
    router.delete('/videos/:id', isAuthenticated, isAdmin, (req, res) => {
        const { id } = req.params;
        db.run(`DELETE FROM videos WHERE id = ?`, [id], function(err) {
            if (err) {
                console.error('Error deleting video:', err.message);
                return res.status(500).json({ error: 'Failed to delete video.' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Video not found.' });
            }
            res.status(200).json({ message: 'Video deleted successfully.' });
        });
    });

    return router;
};