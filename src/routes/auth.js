const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// POST /api/login
router.post('/login', authController.login);

// POST /api/logout
router.post('/logout', authController.logout);

// GET /api/auth/status
router.get('/auth/status', authController.status);

module.exports = router;
