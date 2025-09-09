const db = require('../db/database');

// GET all tags
exports.getAllTags = (req, res) => {
    const sql = 'SELECT * FROM tags ORDER BY name ASC';
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error('Error fetching tags:', err.message);
            return res.status(500).json({ error: 'Failed to fetch tags.' });
        }
        res.status(200).json(rows);
    });
};

// POST a new tag
exports.createTag = (req, res) => {
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'Tag name is required.' });
    }
    const sql = 'INSERT INTO tags (name) VALUES (?)';
    db.run(sql, [name], function(err) {
        if (err) {
            console.error('Error adding tag:', err.message);
            if (err.code === 'SQLITE_CONSTRAINT') {
                return res.status(409).json({ error: 'Tag with this name already exists.' });
            }
            return res.status(500).json({ error: 'Failed to add tag.' });
        }
        res.status(201).json({ id: this.lastID, name, message: 'Tag added successfully.' });
    });
};

// PUT/UPDATE a tag
exports.updateTag = (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'Tag name is required.' });
    }
    const sql = 'UPDATE tags SET name = ? WHERE id = ?';
    db.run(sql, [name, id], function(err) {
        if (err) {
            console.error('Error updating tag:', err.message);
            return res.status(500).json({ error: 'Failed to update tag.' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Tag not found.' });
        }
        res.status(200).json({ message: 'Tag updated successfully.' });
    });
};

// DELETE a tag
exports.deleteTag = (req, res) => {
    const { id } = req.params;
    const sql = 'DELETE FROM tags WHERE id = ?';
    db.run(sql, id, function(err) {
        if (err) {
            console.error('Error deleting tag:', err.message);
            return res.status(500).json({ error: 'Failed to delete tag.' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Tag not found.' });
        }
        // Also remove associations in video_tags
        db.run('DELETE FROM video_tags WHERE tag_id = ?', id);
        res.status(200).json({ message: 'Tag deleted successfully.' });
    });
};
