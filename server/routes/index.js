const express = require('express');
const router = express.Router();

// Import all route modules
const authRoutes = require('./auth');
const videoRoutes = require('./videos');
const categoryRoutes = require('./categories');
const proxyRoutes = require('./proxy');
const userRoutes = require('./users');
const favoriteRoutes = require('./favorites');
const commentRoutes = require('./comments');
const reportRoutes = require('./reports');
const reportReasonRoutes = require('./report-reasons');
const logRoutes = require('./logs');
const settingRoutes = require('./settings');
const uploadRoutes = require('./uploads');
const groupRoutes = require('./groups');
const permissionRoutes = require('./permissions');
const passwordPolicyRoutes = require('./password-policies');
const tagRoutes = require('./tags');
const playlistRoutes = require('./playlists');
const searchRoutes = require('./search');
const contentScheduleRoutes = require('./content-schedule');
const auditTrailRoutes = require('./audit-trail');
const aiRoutes = require('./ai');
const healthRoutes = require('./health');
const apiManagementRoutes = require('./api-management');
const videoCompressionRoutes = require('./video-compression');
const backupRoutes = require('./backups');

// Mount routes
router.use('/auth', authRoutes);
router.use('/videos', videoRoutes);
router.use('/categories', categoryRoutes);
router.use('/', proxyRoutes);
router.use('/users', userRoutes);
router.use('/favorites', favoriteRoutes);
router.use('/comments', commentRoutes);
router.use('/reports', reportRoutes);
router.use('/report-reasons', reportReasonRoutes);
router.use('/logs', logRoutes);
router.use('/settings', settingRoutes);
router.use('/uploads', uploadRoutes);
router.use('/groups', groupRoutes);
router.use('/permissions', permissionRoutes);
router.use('/password-policies', passwordPolicyRoutes);
router.use('/tags', tagRoutes);
router.use('/playlists', playlistRoutes);
router.use('/search', searchRoutes);
router.use('/content-schedule', contentScheduleRoutes);
router.use('/audit-trail', auditTrailRoutes);
router.use('/ai', aiRoutes);
router.use('/health', healthRoutes);
router.use('/api-management', apiManagementRoutes);
router.use('/video-compression', videoCompressionRoutes);
router.use('/backups', backupRoutes);

// API health check
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'VisionHub API is running',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// API documentation endpoint
router.get('/docs', (req, res) => {
    res.json({
        success: true,
        message: 'VisionHub API Documentation',
        endpoints: {
            authentication: {
                'POST /api/auth/login': 'Login user',
                'POST /api/auth/logout': 'Logout user',
                'GET /api/auth/verify': 'Verify token'
            },
            videos: {
                'GET /api/videos': 'Get all videos',
                'GET /api/videos/featured': 'Get featured videos',
                'GET /api/videos/trending': 'Get trending videos',
                'GET /api/videos/search?q=query': 'Search videos',
                'GET /api/videos/:id': 'Get video by ID',
                'POST /api/videos/:id/view': 'Record video view',
                'POST /api/videos': 'Create video (admin)',
                'PUT /api/videos/:id': 'Update video (admin)',
                'DELETE /api/videos/:id': 'Delete video (admin)'
            },
            categories: {
                'GET /api/categories': 'Get all categories',
                'GET /api/categories/:id': 'Get category by ID',
                'POST /api/categories': 'Create category (admin)',
                'PUT /api/categories/:id': 'Update category (admin)',
                'DELETE /api/categories/:id': 'Delete category (admin)'
            },
            users: {
                'GET /api/users': 'Get all users (admin)',
                'GET /api/users/:username': 'Get user by username',
                'POST /api/users': 'Create user (admin)',
                'PUT /api/users/:username': 'Update user',
                'PATCH /api/users/:username/role': 'Change user role (admin)'
            },
            favorites: {
                'GET /api/favorites': 'Get user favorites',
                'GET /api/favorites/:videoId': 'Check if video is favorited',
                'POST /api/favorites/:videoId': 'Add to favorites',
                'DELETE /api/favorites/:videoId': 'Remove from favorites'
            },
            comments: {
                'GET /api/comments/video/:videoId': 'Get video comments',
                'POST /api/comments': 'Create comment',
                'DELETE /api/comments/:id': 'Delete comment'
            },
            reports: {
                'GET /api/reports': 'Get all reports (admin)',
                'POST /api/reports': 'Create report',
                'DELETE /api/reports/:id': 'Resolve report (admin)'
            },
            logs: {
                'GET /api/logs': 'Get activity logs (admin)',
                'POST /api/logs': 'Create log entry'
            },
            settings: {
                'GET /api/settings': 'Get all settings',
                'GET /api/settings/:key': 'Get setting by key',
                'POST /api/settings': 'Update multiple settings (admin)',
                'PUT /api/settings/:key': 'Update specific setting (admin)'
            }
        }
    });
});

module.exports = router;