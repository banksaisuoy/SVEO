const express = require('express');
const router = express.Router();
const tagController = require('../controllers/tagController');
const { isAuthenticated, isAdmin } = require('../middleware/authMiddleware');

// All tag routes are admin-only
router.use(isAuthenticated, isAdmin);

// GET /api/tags
router.get('/', tagController.getAllTags);

// POST /api/tags
router.post('/', tagController.createTag);

// PUT /api/tags/:id
router.put('/:id', tagController.updateTag);

// DELETE /api/tags/:id
router.delete('/:id', tagController.deleteTag);

module.exports = router;
