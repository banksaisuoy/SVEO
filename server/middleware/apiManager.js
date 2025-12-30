const rateLimit = require('express-rate-limit');

// API management and monitoring middleware
class APIManager {
    constructor() {
        this.requestCounts = new Map();
        this.errorCounts = new Map();
        this.responseTimes = [];
        this.activeConnections = 0;
    }

    // Create rate limiter with different tiers
    createRateLimiter(windowMs = 15 * 60 * 1000, max = 100, skipSuccessfulRequests = false) {
        return rateLimit({
            windowMs,
            max,
            skipSuccessfulRequests,
            message: {
                error: 'Too many requests from this IP, please try again later.',
                retryAfter: Math.ceil(windowMs / 1000)
            },
            standardHeaders: true,
            legacyHeaders: false,
            handler: (req, res) => {
                this.logRateLimitExceeded(req);
                res.status(429).json({
                    error: 'Too many requests from this IP, please try again later.',
                    retryAfter: Math.ceil(windowMs / 1000)
                });
            }
        });
    }

    // Different rate limits for different endpoints
    getRateLimiters() {
        return {
            // General API rate limit
            general: this.createRateLimiter(15 * 60 * 1000, 100), // 100 requests per 15 minutes

            // Strict rate limit for auth endpoints
            auth: this.createRateLimiter(15 * 60 * 1000, 10), // 10 requests per 15 minutes

            // More lenient for file operations
            files: this.createRateLimiter(15 * 60 * 1000, 50), // 50 requests per 15 minutes

            // Strict for AI operations (expensive)
            ai: this.createRateLimiter(60 * 60 * 1000, 20), // 20 requests per hour

            // Very strict for batch operations
            batch: this.createRateLimiter(60 * 60 * 1000, 5), // 5 requests per hour
        };
    }

    // Request monitoring middleware
    requestMonitor() {
        return (req, res, next) => {
            const startTime = Date.now();
            this.activeConnections++;

            // Track request
            const key = `${req.method}:${req.path}`;
            this.requestCounts.set(key, (this.requestCounts.get(key) || 0) + 1);

            // Override res.end to capture response time
            const originalEnd = res.end;
            res.end = (...args) => {
                const responseTime = Date.now() - startTime;

                // Track response time
                this.responseTimes.push({
                    path: req.path,
                    method: req.method,
                    responseTime,
                    statusCode: res.statusCode,
                    timestamp: new Date()
                });

                // Keep only last 1000 entries
                if (this.responseTimes.length > 1000) {
                    this.responseTimes = this.responseTimes.slice(-1000);
                }

                // Track errors
                if (res.statusCode >= 400) {
                    this.errorCounts.set(key, (this.errorCounts.get(key) || 0) + 1);
                }

                this.activeConnections--;

                // Call original end method
                originalEnd.apply(res, args);
            };

            next();
        };
    }

    // API key validation middleware
    validateApiKey() {
        return (req, res, next) => {
            const apiKey = req.headers['x-api-key'];

            // Skip API key validation for certain endpoints
            if (req.path.includes('/auth/') || req.path === '/api/health') {
                return next();
            }

            // For now, just log API key usage
            if (apiKey) {
                console.log(`API Key used: ${apiKey.substring(0, 8)}...`);
            }

            next();
        };
    }

    // CORS configuration with security headers
    securityHeaders() {
        return (req, res, next) => {
            // Security headers
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('X-Frame-Options', 'DENY');
            res.setHeader('X-XSS-Protection', '1; mode=block');
            res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

            // API versioning header
            res.setHeader('API-Version', '1.0');

            next();
        };
    }

    // Log rate limit exceeded events
    logRateLimitExceeded(req) {
        console.warn(`Rate limit exceeded for IP: ${req.ip}, Path: ${req.path}, User-Agent: ${req.get('User-Agent')}`);
    }

    // Get API statistics
    getStatistics() {
        const now = Date.now();
        const oneHourAgo = now - (60 * 60 * 1000);

        // Calculate recent response times
        const recentResponses = this.responseTimes.filter(r => r.timestamp.getTime() > oneHourAgo);
        const avgResponseTime = recentResponses.length > 0
            ? recentResponses.reduce((sum, r) => sum + r.responseTime, 0) / recentResponses.length
            : 0;

        // Count recent errors
        const recentErrors = recentResponses.filter(r => r.statusCode >= 400).length;
        const errorRate = recentResponses.length > 0 ? (recentErrors / recentResponses.length) * 100 : 0;

        // Top endpoints by request count
        const topEndpoints = Array.from(this.requestCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        // Top endpoints by error count
        const topErrors = Array.from(this.errorCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        return {
            activeConnections: this.activeConnections,
            totalRequests: Array.from(this.requestCounts.values()).reduce((sum, count) => sum + count, 0),
            totalErrors: Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0),
            averageResponseTime: Math.round(avgResponseTime),
            errorRate: Math.round(errorRate * 100) / 100,
            recentRequests: recentResponses.length,
            topEndpoints: topEndpoints,
            topErrors: topErrors,
            timestamp: new Date().toISOString()
        };
    }

    // Get detailed metrics for monitoring
    getDetailedMetrics() {
        const stats = this.getStatistics();

        // Response time percentiles
        const sortedTimes = this.responseTimes
            .map(r => r.responseTime)
            .sort((a, b) => a - b);

        const percentiles = {
            p50: this.getPercentile(sortedTimes, 50),
            p90: this.getPercentile(sortedTimes, 90),
            p95: this.getPercentile(sortedTimes, 95),
            p99: this.getPercentile(sortedTimes, 99)
        };

        // Status code distribution
        const statusCodes = {};
        this.responseTimes.forEach(r => {
            const code = `${Math.floor(r.statusCode / 100)}xx`;
            statusCodes[code] = (statusCodes[code] || 0) + 1;
        });

        return {
            ...stats,
            responseTimePercentiles: percentiles,
            statusCodeDistribution: statusCodes,
            requestTrends: this.getRequestTrends()
        };
    }

    // Calculate percentile
    getPercentile(sortedArray, percentile) {
        if (sortedArray.length === 0) return 0;
        const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
        return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
    }

    // Get request trends over time
    getRequestTrends() {
        const now = new Date();
        const trends = {};

        // Group by hour for the last 24 hours
        for (let i = 23; i >= 0; i--) {
            const hour = new Date(now.getTime() - (i * 60 * 60 * 1000));
            const hourKey = hour.toISOString().substring(0, 13);
            trends[hourKey] = 0;
        }

        this.responseTimes.forEach(r => {
            const hourKey = r.timestamp.toISOString().substring(0, 13);
            if (trends.hasOwnProperty(hourKey)) {
                trends[hourKey]++;
            }
        });

        return trends;
    }

    // Reset statistics
    resetStatistics() {
        this.requestCounts.clear();
        this.errorCounts.clear();
        this.responseTimes = [];
        console.log('API statistics reset');
    }
}

module.exports = new APIManager();