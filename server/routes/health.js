const express = require('express');
const healthMonitor = require('../services/healthMonitor');
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

// Get current system health status
router.get('/status', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const healthReport = await healthMonitor.performHealthCheck();
        res.json({
            success: true,
            health: healthReport
        });
    } catch (error) {
        console.error('Health status error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get quick health overview
router.get('/overview', authenticateToken, requireAdmin, async (req, res) => {
    try {
        let overview;

        if (healthMonitor.lastCheck) {
            const lastCheck = healthMonitor.lastCheck;
            overview = {
                overall: lastCheck.overall,
                lastChecked: lastCheck.timestamp,
                summary: {
                    system: {
                        status: lastCheck.system.cpu ? 'healthy' : 'unknown',
                        cpuUsage: lastCheck.system.cpu?.usage || 0,
                        memoryUsage: lastCheck.system.memory?.usagePercent || 0
                    },
                    database: {
                        status: lastCheck.database.status || 'unknown',
                        responseTime: lastCheck.database.responseTime || 0
                    },
                    application: {
                        status: lastCheck.application.status || 'unknown',
                        uptime: lastCheck.application.process?.uptime || 0
                    }
                },
                alerts: healthMonitor.getAlerts()
            };
        } else {
            // Perform a quick check if no previous data
            const healthReport = await healthMonitor.performHealthCheck();
            overview = {
                overall: healthReport.overall,
                lastChecked: healthReport.timestamp,
                summary: {
                    system: {
                        status: healthReport.system.cpu ? 'healthy' : 'unknown',
                        cpuUsage: healthReport.system.cpu?.usage || 0,
                        memoryUsage: healthReport.system.memory?.usagePercent || 0
                    },
                    database: {
                        status: healthReport.database.status || 'unknown',
                        responseTime: healthReport.database.responseTime || 0
                    },
                    application: {
                        status: healthReport.application.status || 'unknown',
                        uptime: healthReport.application.process?.uptime || 0
                    }
                },
                alerts: healthMonitor.getAlerts()
            };
        }

        res.json({
            success: true,
            overview
        });
    } catch (error) {
        console.error('Health overview error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get system metrics only
router.get('/metrics', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const metrics = await healthMonitor.getSystemMetrics();
        res.json({
            success: true,
            metrics
        });
    } catch (error) {
        console.error('System metrics error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get database health
router.get('/database', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const dbHealth = await healthMonitor.checkDatabaseHealth();
        res.json({
            success: true,
            database: dbHealth
        });
    } catch (error) {
        console.error('Database health error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get application health
router.get('/application', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const appHealth = await healthMonitor.checkApplicationHealth();
        res.json({
            success: true,
            application: appHealth
        });
    } catch (error) {
        console.error('Application health error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get external services health
router.get('/services', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const servicesHealth = await healthMonitor.checkExternalServices();
        res.json({
            success: true,
            services: servicesHealth
        });
    } catch (error) {
        console.error('Services health error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get health history
router.get('/history', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { limit } = req.query;
        const historyLimit = parseInt(limit) || 20;

        const history = healthMonitor.getHealthHistory(historyLimit);
        res.json({
            success: true,
            history
        });
    } catch (error) {
        console.error('Health history error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get current alerts
router.get('/alerts', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const alerts = healthMonitor.getAlerts();
        res.json({
            success: true,
            alerts
        });
    } catch (error) {
        console.error('Health alerts error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Start health monitoring
router.post('/monitoring/start', authenticateToken, requireAdmin, async (req, res) => {
    try {
        healthMonitor.startMonitoring();
        res.json({
            success: true,
            message: 'Health monitoring started'
        });
    } catch (error) {
        console.error('Start monitoring error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Stop health monitoring
router.post('/monitoring/stop', authenticateToken, requireAdmin, async (req, res) => {
    try {
        healthMonitor.stopMonitoring();
        res.json({
            success: true,
            message: 'Health monitoring stopped'
        });
    } catch (error) {
        console.error('Stop monitoring error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get monitoring status
router.get('/monitoring/status', authenticateToken, requireAdmin, async (req, res) => {
    try {
        res.json({
            success: true,
            monitoring: {
                isActive: healthMonitor.isMonitoring,
                interval: healthMonitor.checkInterval,
                lastCheck: healthMonitor.lastCheck?.timestamp || null,
                totalChecks: healthMonitor.healthChecks.length
            }
        });
    } catch (error) {
        console.error('Monitoring status error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Export health data
router.get('/export', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { format = 'json', limit } = req.query;
        const historyLimit = parseInt(limit) || 50;

        const healthData = {
            exportedAt: new Date().toISOString(),
            currentStatus: healthMonitor.lastCheck,
            history: healthMonitor.getHealthHistory(historyLimit),
            alerts: healthMonitor.getAlerts()
        };

        if (format === 'csv') {
            // Convert to CSV format
            let csv = 'Timestamp,Overall,CPU Usage,Memory Usage,DB Response Time,DB Status,App Status\n';

            healthData.history.forEach(check => {
                csv += [
                    check.timestamp,
                    check.overall,
                    check.system.cpu?.usage || 'N/A',
                    check.system.memory?.usagePercent || 'N/A',
                    check.database.responseTime || 'N/A',
                    check.database.status || 'N/A',
                    check.application.status || 'N/A'
                ].join(',') + '\n';
            });

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="health_report_${new Date().toISOString().split('T')[0]}.csv"`);
            res.send(csv);
        } else {
            res.json({
                success: true,
                data: healthData
            });
        }
    } catch (error) {
        console.error('Health export error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;