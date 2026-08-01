const express = require('express');

module.exports = (db, isAdmin) => {
    const router = express.Router();

    // GET all categories
    router.get('/', (req, res) => {
        const sql = `SELECT * FROM categories ORDER BY name ASC`;
        db.all(sql, [], (err, rows) => {
            if (err) {
                console.error('Error fetching categories:', err.message);
                return res.status(500).json({ error: 'Failed to fetch categories.' });
            }
            res.status(200).json(rows);
        });
    });

    // POST a new category (Admin only)
    router.post('/', isAdmin, (req, res) => {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Category name is required.' });
        }
        const sql = `INSERT INTO categories (name) VALUES (?)`;
        db.run(sql, [name], function(err) {
            if (err) {
                console.error('Error adding category:', err.message);
                return res.status(500).json({ error: 'Failed to add category. Category may already exist.' });
            }
            res.status(201).json({ id: this.lastID, name, message: 'Category added successfully.' });
        });
    });

    // PUT update category (Admin only)
    router.put('/:id', isAdmin, (req, res) => {
        const { id } = req.params;
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Category name is required.' });
        }
        const sql = `UPDATE categories SET name = ? WHERE id = ?`;
        db.run(sql, [name, id], function(err) {
            if (err) {
                console.error('Error updating category:', err.message);
                return res.status(500).json({ error: 'Failed to update category.' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Category not found.' });
            }
            res.status(200).json({ id, name, message: 'Category updated successfully.' });
        });
    });

    // DELETE a category (Admin only)
    router.delete('/:id', isAdmin, (req, res) => {
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
    });

    return router;
};