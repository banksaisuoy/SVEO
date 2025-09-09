const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { isAuthenticated, isAdmin } = require('../middleware/authMiddleware');

// GET /api/categories - Public
router.get('/', categoryController.getAllCategories);

// POST /api/categories - Admin only
router.post('/', isAuthenticated, isAdmin, categoryController.createCategory);

// DELETE /api/categories/:id - Admin only
router.delete('/:id', isAuthenticated, isAdmin, categoryController.deleteCategory);

module.exports = router;
