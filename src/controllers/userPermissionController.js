const db = require('../db/database');

// GET permissions for a specific user
exports.getUserPermissions = (req, res) => {
    const { userId } = req.params;
    const sql = `
        SELECT t.id, t.name
        FROM tags t
        JOIN user_tag_permissions utp ON t.id = utp.tag_id
        WHERE utp.user_id = ?
    `;
    db.all(sql, [userId], (err, rows) => {
        if (err) {
            console.error('Error fetching user permissions:', err.message);
            return res.status(500).json({ error: 'Failed to fetch user permissions.' });
        }
        res.status(200).json(rows);
    });
};

// GRANT a user permission to a tag
exports.grantPermission = (req, res) => {
    const { userId, tagId } = req.body;
    if (!userId || !tagId) {
        return res.status(400).json({ error: 'User ID and Tag ID are required.' });
    }

    const sql = 'INSERT INTO user_tag_permissions (user_id, tag_id) VALUES (?, ?)';
    db.run(sql, [userId, tagId], function(err) {
        if (err) {
            console.error('Error granting permission:', err.message);
            if (err.code === 'SQLITE_CONSTRAINT') {
                return res.status(409).json({ error: 'This permission has already been granted.' });
            }
            return res.status(500).json({ error: 'Failed to grant permission.' });
        }
        res.status(201).json({ message: 'Permission granted successfully.' });
    });
};

// REVOKE a user's permission from a tag
exports.revokePermission = (req, res) => {
    const { userId, tagId } = req.body;
    if (!userId || !tagId) {
        return res.status(400).json({ error: 'User ID and Tag ID are required.' });
    }

    const sql = 'DELETE FROM user_tag_permissions WHERE user_id = ? AND tag_id = ?';
    db.run(sql, [userId, tagId], function(err) {
        if (err) {
            console.error('Error revoking permission:', err.message);
            return res.status(500).json({ error: 'Failed to revoke permission.' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Permission not found or already revoked.' });
        }
        res.status(200).json({ message: 'Permission revoked successfully.' });
    });
};
