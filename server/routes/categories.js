const express = require('express');
const { Database, Category, Log } = require('../models/index');
const router = express.Router();

let database;

// Initialize database connection
async function initDatabase() {
    if (!database) {
        database = new Database();
        await database.connect();
    }
    return database;
}

// Authentication middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
}

// Admin middleware
function requireAdmin(req, res, next) {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}

// Get all categories
router.get('/', async (req, res) => {
    try {
        const db = await initDatabase();
        const categories = await Category.getAll(db);
        res.json({ success: true, categories });
    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get single category by ID
router.get('/:id', async (req, res) => {
    try {
        const db = await initDatabase();
        const { id } = req.params;
        const category = await Category.getById(db, id);

        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }

        res.json({ success: true, category });
    } catch (error) {
        console.error('Get category error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create new category (admin only)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = await initDatabase();
        const { name } = req.body;

        if (!name || name.trim().length === 0) {
            return res.status(400).json({ error: 'Category name is required' });
        }

        const result = await Category.create(db, name.trim());
        await Log.create(db, req.user.username, 'Add Category', `Added new category: ${name}`);

        res.status(201).json({
            success: true,
            message: 'Category created successfully',
            categoryId: result.id
        });
    } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
            return res.status(409).json({ error: 'Category name already exists' });
        }
        console.error('Create category error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update category (admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = await initDatabase();
        const { id } = req.params;
        const { name } = req.body;

        // Check if category exists
        const existingCategory = await Category.getById(db, id);
        if (!existingCategory) {
            return res.status(404).json({ error: 'Category not found' });
        }

        if (!name || name.trim().length === 0) {
            return res.status(400).json({ error: 'Category name is required' });
        }

        await Category.update(db, id, name.trim());
        await Log.create(db, req.user.username, 'Update Category', `Updated category ID: ${id}`);

        res.json({ success: true, message: 'Category updated successfully' });
    } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
            return res.status(409).json({ error: 'Category name already exists' });
        }
        console.error('Update category error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete category (admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = await initDatabase();
        const { id } = req.params;

        // Check if category exists
        const existingCategory = await Category.getById(db, id);
        if (!existingCategory) {
            return res.status(404).json({ error: 'Category not found' });
        }

        // Check if there are videos using this category
        const videosInCategory = await db.all('SELECT COUNT(*) as count FROM videos WHERE categoryId = ?', [id]);
        if (videosInCategory[0].count > 0) {
            return res.status(400).json({
                error: 'Cannot delete category that contains videos. Please reassign or delete videos first.'
            });
        }

        await Category.delete(db, id);
        await Log.create(db, req.user.username, 'Delete Category', `Deleted category ID: ${id}`);

        res.json({ success: true, message: 'Category deleted successfully' });
    } catch (error) {
        console.error('Delete category error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;