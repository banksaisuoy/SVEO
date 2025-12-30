const os = require('os');
const fs = require('fs').promises;
const path = require('path');
const { Database } = require('../models/index');

class SystemHealthMonitor {
    constructor() {
        this.database = null;
        this.healthChecks = [];
        this.lastCheck = null;
        this.checkInterval = 30000; // 30 seconds
        this.isMonitoring = false;
    }

    async initDatabase() {
        if (!this.database) {
            this.database = new Database();
            await this.database.connect();
        }
        return this.database;
    }

    /**
     * Get system performance metrics
     */
    async getSystemMetrics() {
        const metrics = {
            timestamp: new Date().toISOString(),
            cpu: {
                cores: os.cpus().length,
                model: os.cpus()[0].model,
                usage: await this.getCpuUsage(),
                loadAverage: os.loadavg()
            },
            memory: {
                total: Math.round(os.totalmem() / 1024 / 1024), // MB
                free: Math.round(os.freemem() / 1024 / 1024), // MB
                used: Math.round((os.totalmem() - os.freemem()) / 1024 / 1024), // MB
                usagePercent: Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100)
            },
            disk: await this.getDiskUsage(),
            network: os.networkInterfaces(),
            uptime: {
                system: os.uptime(),
                process: process.uptime()
            },
            platform: {
                type: os.type(),
                platform: os.platform(),
                arch: os.arch(),
                release: os.release(),
                hostname: os.hostname()
            }
        };

        return metrics;
    }

    /**
     * Get CPU usage percentage
     */
    async getCpuUsage() {
        return new Promise((resolve) => {
            const startMeasure = this.cpuAverage();

            setTimeout(() => {
                const endMeasure = this.cpuAverage();
                const idleDifference = endMeasure.idle - startMeasure.idle;
                const totalDifference = endMeasure.total - startMeasure.total;
                const cpuPercent = 100 - Math.round(100 * idleDifference / totalDifference);
                resolve(cpuPercent);
            }, 1000);
        });
    }

    cpuAverage() {
        const cpus = os.cpus();
        let idleMs = 0;
        let totalMs = 0;

        cpus.forEach((cpu) => {
            for (const type in cpu.times) {
                totalMs += cpu.times[type];
            }
            idleMs += cpu.times.idle;
        });

        return {
            idle: idleMs / cpus.length,
            total: totalMs / cpus.length
        };
    }

    /**
     * Get disk usage information
     */
    async getDiskUsage() {
        try {
            const stats = await fs.stat(process.cwd());
            // This is a basic implementation - for production, use a library like 'diskusage'
            return {
                path: process.cwd(),
                available: 'N/A', // Requires external library
                used: 'N/A',
                total: 'N/A'
            };
        } catch (error) {
            return {
                error: 'Unable to get disk usage',
                path: process.cwd()
            };
        }
    }

    /**
     * Check database health
     */
    async checkDatabaseHealth() {
        try {
            const db = await this.initDatabase();

            // Test connection
            const startTime = Date.now();
            await db.get('SELECT 1 as test');
            const responseTime = Date.now() - startTime;

            // Get database stats
            const videoCount = await db.get('SELECT COUNT(*) as count FROM videos');
            const userCount = await db.get('SELECT COUNT(*) as count FROM users');
            const categoryCount = await db.get('SELECT COUNT(*) as count FROM categories');

            // Check for long-running queries (simulate)
            const dbSize = await this.getDatabaseSize();

            return {
                status: 'healthy',
                responseTime: responseTime,
                stats: {
                    videos: videoCount.count,
                    users: userCount.count,
                    categories: categoryCount.count,
                    databaseSize: dbSize
                },
                lastChecked: new Date().toISOString()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                lastChecked: new Date().toISOString()
            };
        }
    }

    /**
     * Get database file size
     */
    async getDatabaseSize() {
        try {
            const dbPath = path.join(__dirname, '../visionhub.db');
            const stats = await fs.stat(dbPath);
            return Math.round(stats.size / 1024 / 1024 * 100) / 100; // MB with 2 decimal places
        } catch (error) {
            return 'Unknown';
        }
    }

    /**
     * Check application health
     */
    async checkApplicationHealth() {
        try {
            const processMemory = process.memoryUsage();
            const processInfo = {
                pid: process.pid,
                version: process.version,
                uptime: process.uptime(),
                memory: {
                    rss: Math.round(processMemory.rss / 1024 / 1024), // MB
                    heapTotal: Math.round(processMemory.heapTotal / 1024 / 1024), // MB
                    heapUsed: Math.round(processMemory.heapUsed / 1024 / 1024), // MB
                    external: Math.round(processMemory.external / 1024 / 1024) // MB
                }
            };

            // Check if critical directories exist
            const uploadsDir = path.join(__dirname, '../public/uploads');
            const dirChecks = {
                uploads: await this.checkDirectory(uploadsDir),
                videos: await this.checkDirectory(path.join(uploadsDir, 'videos')),
                thumbnails: await this.checkDirectory(path.join(uploadsDir, 'thumbnails'))
            };

            return {
                status: 'healthy',
                process: processInfo,
                directories: dirChecks,
                environment: {
                    nodeVersion: process.version,
                    environment: process.env.NODE_ENV || 'development'
                },
                lastChecked: new Date().toISOString()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                lastChecked: new Date().toISOString()
            };
        }
    }

    /**
     * Check if directory exists and is writable
     */
    async checkDirectory(dirPath) {
        try {
            await fs.access(dirPath, fs.constants.F_OK | fs.constants.W_OK);
            const stats = await fs.stat(dirPath);
            return {
                exists: true,
                writable: true,
                isDirectory: stats.isDirectory(),
                size: stats.size
            };
        } catch (error) {
            return {
                exists: false,
                writable: false,
                error: error.message
            };
        }
    }

    /**
     * Check external service health (AI, etc.)
     */
    async checkExternalServices() {
        const services = {
            geminiAI: {
                configured: !!process.env.GEMINI_API_KEY,
                status: process.env.GEMINI_API_KEY ? 'configured' : 'not_configured'
            }
        };

        // Test Gemini AI if configured
        if (process.env.GEMINI_API_KEY) {
            try {
                const aiService = require('./aiService');
                // Check if AI service is properly initialized before using it
                if (aiService.initialized) {
                    const testResult = await aiService.categorizeVideo({
                        title: 'Test video',
                        description: 'This is a test for health monitoring'
                    });
                    services.geminiAI.status = testResult.success ? 'healthy' : 'unhealthy';
                    services.geminiAI.lastTest = new Date().toISOString();
                } else {
                    services.geminiAI.status = 'not_initialized';
                    services.geminiAI.error = 'AI service failed to initialize';
                }
            } catch (error) {
                services.geminiAI.status = 'error';
                services.geminiAI.error = error.message;
                // Log error but don't let it interrupt health checks
                console.error('AI Service health check failed:', error.message);
            }
        }

        return services;
    }

    /**
     * Perform comprehensive health check
     */
    async performHealthCheck() {
        const startTime = Date.now();

        const [systemMetrics, dbHealth, appHealth, externalServices] = await Promise.allSettled([
            this.getSystemMetrics(),
            this.checkDatabaseHealth(),
            this.checkApplicationHealth(),
            this.checkExternalServices()
        ]);

        const healthReport = {
            timestamp: new Date().toISOString(),
            checkDuration: Date.now() - startTime,
            overall: 'healthy', // Will be updated based on individual checks
            system: systemMetrics.status === 'fulfilled' ? systemMetrics.value : { error: systemMetrics.reason?.message },
            database: dbHealth.status === 'fulfilled' ? dbHealth.value : { error: dbHealth.reason?.message },
            application: appHealth.status === 'fulfilled' ? appHealth.value : { error: appHealth.reason?.message },
            externalServices: externalServices.status === 'fulfilled' ? externalServices.value : { error: externalServices.reason?.message }
        };

        // Determine overall health
        const hasErrors = [dbHealth, appHealth].some(check =>
            check.status === 'rejected' ||
            (check.status === 'fulfilled' && check.value.status === 'unhealthy')
        );

        healthReport.overall = hasErrors ? 'unhealthy' : 'healthy';

        // Store health check in memory (in production, consider storing in database)
        this.lastCheck = healthReport;
        this.healthChecks.unshift(healthReport);

        // Keep only last 100 checks
        if (this.healthChecks.length > 100) {
            this.healthChecks = this.healthChecks.slice(0, 100);
        }

        return healthReport;
    }

    /**
     * Start continuous monitoring
     */
    startMonitoring() {
        if (this.isMonitoring) return;

        this.isMonitoring = true;
        this.monitoringInterval = setInterval(async () => {
            try {
                await this.performHealthCheck();
            } catch (error) {
                console.error('Health check error:', error);
            }
        }, this.checkInterval);

        console.log('System health monitoring started');
    }

    /**
     * Stop continuous monitoring
     */
    stopMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.isMonitoring = false;
            console.log('System health monitoring stopped');
        }
    }

    /**
     * Get health history
     */
    getHealthHistory(limit = 20) {
        return this.healthChecks.slice(0, limit);
    }

    /**
     * Get alerts based on thresholds
     */
    getAlerts() {
        if (!this.lastCheck) return [];

        const alerts = [];
        const check = this.lastCheck;

        // CPU usage alert
        if (check.system.cpu?.usage > 80) {
            alerts.push({
                type: 'warning',
                category: 'cpu',
                message: `High CPU usage: ${check.system.cpu.usage}%`,
                timestamp: check.timestamp
            });
        }

        // Memory usage alert
        if (check.system.memory?.usagePercent > 90) {
            alerts.push({
                type: 'critical',
                category: 'memory',
                message: `High memory usage: ${check.system.memory.usagePercent}%`,
                timestamp: check.timestamp
            });
        }

        // Database response time alert
        if (check.database.responseTime > 1000) {
            alerts.push({
                type: 'warning',
                category: 'database',
                message: `Slow database response: ${check.database.responseTime}ms`,
                timestamp: check.timestamp
            });
        }

        // Database health alert
        if (check.database.status === 'unhealthy') {
            alerts.push({
                type: 'critical',
                category: 'database',
                message: `Database health check failed: ${check.database.error}`,
                timestamp: check.timestamp
            });
        }

        // Application health alert
        if (check.application.status === 'unhealthy') {
            alerts.push({
                type: 'critical',
                category: 'application',
                message: `Application health check failed: ${check.application.error}`,
                timestamp: check.timestamp
            });
        }

        return alerts;
    }
}

module.exports = new SystemHealthMonitor();