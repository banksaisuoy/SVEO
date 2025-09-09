const db = require('../db/database');

// GET all categories
exports.getAllCategories = (req, res) => {
    const sql = `SELECT * FROM categories ORDER BY name ASC`;
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error('Error fetching categories:', err.message);
            return res.status(500).json({ error: 'Failed to fetch categories.' });
        }
        res.status(200).json(rows);
    });
};

// POST a new category
exports.createCategory = (req, res) => {
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'Category name is required.' });
    }
    const sql = `INSERT INTO categories (name) VALUES (?)`;
    db.run(sql, [name], function(err) {
        if (err) {
            console.error('Error adding category:', err.message);
            // Unique constraint error
            if (err.code === 'SQLITE_CONSTRAINT') {
                return res.status(409).json({ error: 'Category with this name already exists.' });
            }
            return res.status(500).json({ error: 'Failed to add category.' });
        }
        res.status(201).json({ id: this.lastID, name, message: 'Category added successfully.' });
    });
};

// DELETE a category
exports.deleteCategory = (req, res) => {
    const { id } = req.params;
    const sql = `DELETE FROM categories WHERE id = ?`;
    db.run(sql, id, function(err) {
        if (err) {
            console.error('Error deleting category:', err.message);
            return res.status(500).json({ error: 'Failed to delete category.' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Category not found.' });
        }
        res.status(200).json({ message: 'Category deleted successfully.' });
    });
};
