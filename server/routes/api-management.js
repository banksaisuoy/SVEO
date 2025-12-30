const express = require('express');
const apiManager = require('../middleware/apiManager');
const router = express.Router();

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

// Get API statistics
router.get('/stats', authenticateToken, requireAdmin, (req, res) => {
    try {
        const stats = apiManager.getStatistics();
        res.json({
            success: true,
            statistics: stats
        });
    } catch (error) {
        console.error('API stats error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get detailed API metrics
router.get('/metrics', authenticateToken, requireAdmin, (req, res) => {
    try {
        const metrics = apiManager.getDetailedMetrics();
        res.json({
            success: true,
            metrics: metrics
        });
    } catch (error) {
        console.error('API metrics error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Reset API statistics
router.post('/reset', authenticateToken, requireAdmin, (req, res) => {
    try {
        apiManager.resetStatistics();
        res.json({
            success: true,
            message: 'API statistics reset successfully'
        });
    } catch (error) {
        console.error('API reset error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get rate limit information
router.get('/rate-limits', authenticateToken, requireAdmin, (req, res) => {
    try {
        const rateLimits = {
            general: {
                windowMs: 15 * 60 * 1000,
                max: 100,
                description: '100 requests per 15 minutes for general API endpoints'
            },
            auth: {
                windowMs: 15 * 60 * 1000,
                max: 10,
                description: '10 requests per 15 minutes for authentication endpoints'
            },
            files: {
                windowMs: 15 * 60 * 1000,
                max: 50,
                description: '50 requests per 15 minutes for file operations'
            },
            ai: {
                windowMs: 60 * 60 * 1000,
                max: 20,
                description: '20 requests per hour for AI operations'
            },
            batch: {
                windowMs: 60 * 60 * 1000,
                max: 5,
                description: '5 requests per hour for batch operations'
            }
        };

        res.json({
            success: true,
            rateLimits: rateLimits
        });
    } catch (error) {
        console.error('Rate limits error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// API health check with detailed information
router.get('/health', (req, res) => {
    try {
        const stats = apiManager.getStatistics();
        const health = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            api: {
                activeConnections: stats.activeConnections,
                averageResponseTime: stats.averageResponseTime,
                errorRate: stats.errorRate,
                totalRequests: stats.totalRequests
            },
            rateLimit: {
                status: 'active',
                limits: [
                    'General: 100/15min',
                    'Auth: 10/15min',
                    'Files: 50/15min',
                    'AI: 20/hour',
                    'Batch: 5/hour'
                ]
            }
        };

        // Determine overall health status
        if (stats.errorRate > 10) {
            health.status = 'degraded';
        }
        if (stats.errorRate > 25) {
            health.status = 'unhealthy';
        }
        if (stats.averageResponseTime > 2000) {
            health.status = health.status === 'healthy' ? 'degraded' : health.status;
        }

        res.json({
            success: true,
            health: health
        });
    } catch (error) {
        console.error('API health error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            health: {
                status: 'unhealthy',
                timestamp: new Date().toISOString()
            }
        });
    }
});

// Export API usage report
router.get('/report', authenticateToken, requireAdmin, (req, res) => {
    try {
        const { format = 'json', period = '24h' } = req.query;

        const metrics = apiManager.getDetailedMetrics();
        const report = {
            generatedAt: new Date().toISOString(),
            period: period,
            summary: {
                totalRequests: metrics.totalRequests,
                totalErrors: metrics.totalErrors,
                errorRate: metrics.errorRate,
                averageResponseTime: metrics.averageResponseTime,
                activeConnections: metrics.activeConnections
            },
            performance: {
                responseTimePercentiles: metrics.responseTimePercentiles,
                statusCodeDistribution: metrics.statusCodeDistribution
            },
            usage: {
                topEndpoints: metrics.topEndpoints,
                topErrors: metrics.topErrors,
                requestTrends: metrics.requestTrends
            }
        };

        if (format === 'csv') {
            // Convert to CSV format
            let csv = 'Timestamp,Endpoint,Requests,Errors,Error Rate\n';

            metrics.topEndpoints.forEach(([endpoint, requests]) => {
                const errors = metrics.topErrors.find(([e, count]) => e === endpoint)?.[1] || 0;
                const errorRate = requests > 0 ? ((errors / requests) * 100).toFixed(2) : '0.00';
                csv += `${new Date().toISOString()},${endpoint},${requests},${errors},${errorRate}%\n`;
            });

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="api_report_${new Date().toISOString().split('T')[0]}.csv"`);
            res.send(csv);
        } else {
            res.json({
                success: true,
                report: report
            });
        }
    } catch (error) {
        console.error('API report error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;