const express = require('express');
const router = express.Router();
const userPermissionController = require('../controllers/userPermissionController');
const { isAuthenticated, isAdmin } = require('../middleware/authMiddleware');

// All permission routes are admin-only
router.use(isAuthenticated, isAdmin);

// GET /api/permissions/user/:userId
router.get('/user/:userId', userPermissionController.getUserPermissions);

// POST /api/permissions/grant
router.post('/grant', userPermissionController.grantPermission);

// POST /api/permissions/revoke (using POST for consistency with a body)
router.post('/revoke', userPermissionController.revokePermission);

module.exports = router;
