// VisionHub - System Health Management Module
// This file contains system health monitoring functionality for the admin panel

class SystemHealthManagement {
    constructor(app) {
        this.app = app;
    }

    // Render System Health Management
    async render() {
        const adminContent = document.getElementById('admin-content');

        try {
            const [healthResponse, metricsResponse, alertsResponse] = await Promise.all([
                this.app.api.get('/health/overview'),
                this.app.api.get('/health/metrics'),
                this.app.api.get('/health/alerts')
            ]);

            const health = healthResponse.success ? healthResponse.overview : {};
            const metrics = metricsResponse.success ? metricsResponse.metrics : {};
            const alerts = alertsResponse.success ? alertsResponse.alerts : [];

            const healthStatusColor = health.overall === 'healthy' ? 'text-green-600' :
                                    health.overall === 'degraded' ? 'text-yellow-600' : 'text-red-600';
            const healthBadgeColor = health.overall === 'healthy' ? 'badge-success' :
                                   health.overall === 'degraded' ? 'badge-warning' : 'badge-danger';

            const healthHtml = `
                <div class="space-y-6">
                    <div class="flex justify-between items-center">
                        <h3 class="text-xl font-bold">System Health Monitor</h3>
                        <div class="flex gap-2">
                            <button id="refresh-health-btn" class="btn btn-secondary">Refresh Status</button>
                            <button id="export-health-btn" class="btn btn-info">Export Report</button>
                            <button id="start-monitoring-btn" class="btn btn-success">Start Monitoring</button>
                        </div>
                    </div>

                    <!-- Overall Health Status -->
                    <div class="card ${health.overall === 'healthy' ? 'border-success' : health.overall === 'degraded' ? 'border-warning' : 'border-danger'}">
                        <div class="flex items-center justify-between mb-4">
                            <div class="flex items-center">
                                <span class="badge ${healthBadgeColor} mr-3">${health.overall?.toUpperCase() || 'UNKNOWN'}</span>
                                <h4 class="text-lg font-semibold">System Status</h4>
                            </div>
                            <div class="text-sm text-muted">
                                Last checked: ${health.lastChecked ? new Date(health.lastChecked).toLocaleString() : 'Never'}
                            </div>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div class="metric-card">
                                <h5 class="font-medium text-sm text-muted">System Performance</h5>
                                <div class="mt-2">
                                    <p class="text-lg font-semibold">CPU: ${health.summary?.system?.cpuUsage || 0}%</p>
                                    <p class="text-lg font-semibold">Memory: ${health.summary?.system?.memoryUsage || 0}%</p>
                                </div>
                            </div>
                            <div class="metric-card">
                                <h5 class="font-medium text-sm text-muted">Database Health</h5>
                                <div class="mt-2">
                                    <p class="text-lg font-semibold ${health.summary?.database?.status === 'healthy' ? 'text-green-600' : 'text-red-600'}">
                                        ${health.summary?.database?.status?.toUpperCase() || 'UNKNOWN'}
                                    </p>
                                    <p class="text-sm">Response: ${health.summary?.database?.responseTime || 0}ms</p>
                                </div>
                            </div>
                            <div class="metric-card">
                                <h5 class="font-medium text-sm text-muted">Application</h5>
                                <div class="mt-2">
                                    <p class="text-lg font-semibold ${health.summary?.application?.status === 'healthy' ? 'text-green-600' : 'text-red-600'}">
                                        ${health.summary?.application?.status?.toUpperCase() || 'UNKNOWN'}
                                    </p>
                                    <p class="text-sm">Uptime: ${Math.round((health.summary?.application?.uptime || 0) / 3600)}h</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Alerts Section -->
                    ${alerts.length > 0 ? `
                        <div class="card border-warning">
                            <h4 class="text-lg font-semibold mb-3 text-yellow-600">Active Alerts (${alerts.length})</h4>
                            <div class="space-y-2">
                                ${alerts.map(alert => `
                                    <div class="alert alert-${alert.type} p-3 rounded">
                                        <div class="flex justify-between items-start">
                                            <div>
                                                <span class="badge badge-${alert.type} mr-2">${alert.category.toUpperCase()}</span>
                                                <span class="font-medium">${alert.message}</span>
                                            </div>
                                            <span class="text-xs text-muted">${new Date(alert.timestamp).toLocaleTimeString()}</span>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}

                    <!-- Detailed Metrics -->
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div class="card">
                            <h4 class="text-lg font-semibold mb-3">System Metrics</h4>
                            <div class="space-y-3">
                                <div class="metric-row">
                                    <span class="metric-label">CPU Cores:</span>
                                    <span class="metric-value">${metrics.system?.cpu?.cores || 'N/A'}</span>
                                </div>
                                <div class="metric-row">
                                    <span class="metric-label">Total Memory:</span>
                                    <span class="metric-value">${metrics.system?.memory?.total || 'N/A'} MB</span>
                                </div>
                                <div class="metric-row">
                                    <span class="metric-label">Memory Used:</span>
                                    <span class="metric-value">${metrics.system?.memory?.used || 'N/A'} MB</span>
                                </div>
                                <div class="metric-row">
                                    <span class="metric-label">System Uptime:</span>
                                    <span class="metric-value">${Math.round((metrics.system?.uptime?.system || 0) / 3600)}h</span>
                                </div>
                                <div class="metric-row">
                                    <span class="metric-label">Platform:</span>
                                    <span class="metric-value">${metrics.system?.platform?.type || 'N/A'}</span>
                                </div>
                            </div>
                        </div>

                        <div class="card">
                            <h4 class="text-lg font-semibold mb-3">Database Status</h4>
                            <div class="space-y-3">
                                <div class="metric-row">
                                    <span class="metric-label">Status:</span>
                                    <span class="metric-value ${metrics.database?.status === 'healthy' ? 'text-green-600' : 'text-red-600'}">
                                        ${metrics.database?.status?.toUpperCase() || 'UNKNOWN'}
                                    </span>
                                </div>
                                <div class="metric-row">
                                    <span class="metric-label">Response Time:</span>
                                    <span class="metric-value">${metrics.database?.responseTime || 0}ms</span>
                                </div>
                                <div class="metric-row">
                                    <span class="metric-label">Videos:</span>
                                    <span class="metric-value">${metrics.database?.stats?.videos || 0}</span>
                                </div>
                                <div class="metric-row">
                                    <span class="metric-label">Users:</span>
                                    <span class="metric-value">${metrics.database?.stats?.users || 0}</span>
                                </div>
                                <div class="metric-row">
                                    <span class="metric-label">Database Size:</span>
                                    <span class="metric-value">${metrics.database?.stats?.databaseSize || 'N/A'} MB</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- API Management Section -->
                    <div class="card">
                        <h4 class="text-lg font-semibold mb-3">API Performance</h4>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div class="metric-card">
                                <h5 class="font-medium text-sm text-muted">Active Connections</h5>
                                <p class="text-2xl font-bold">${metrics.api?.activeConnections || 0}</p>
                            </div>
                            <div class="metric-card">
                                <h5 class="font-medium text-sm text-muted">Avg Response Time</h5>
                                <p class="text-2xl font-bold">${metrics.api?.averageResponseTime || 0}ms</p>
                            </div>
                            <div class="metric-card">
                                <h5 class="font-medium text-sm text-muted">Error Rate</h5>
                                <p class="text-2xl font-bold ${(metrics.api?.errorRate || 0) > 5 ? 'text-red-600' : 'text-green-600'}">${metrics.api?.errorRate || 0}%</p>
                            </div>
                        </div>
                    </div>

                    <!-- External Services -->
                    <div class="card">
                        <h4 class="text-lg font-semibold mb-3">External Services</h4>
                        <div class="space-y-3">
                            <div class="service-status">
                                <div class="flex items-center justify-between">
                                    <span class="font-medium">Google Gemini AI</span>
                                    <span class="badge ${metrics.externalServices?.geminiAI?.status === 'healthy' ? 'badge-success' :
                                                          metrics.externalServices?.geminiAI?.status === 'configured' ? 'badge-info' : 'badge-warning'}">
                                        ${metrics.externalServices?.geminiAI?.status?.toUpperCase() || 'UNKNOWN'}
                                    </span>
                                </div>
                                ${metrics.externalServices?.geminiAI?.lastTest ?
                                    `<p class="text-sm text-muted">Last tested: ${new Date(metrics.externalServices.geminiAI.lastTest).toLocaleString()}</p>` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            `;

            adminContent.innerHTML = healthHtml;

            // Event listeners
            this.setupEventHandlers();
        } catch (error) {
            console.error('Error rendering system health:', error);
            adminContent.innerHTML = '<div class="text-center text-error">Error loading system health data</div>';
        }
    }

    // Setup Health Event Handlers
    setupEventHandlers() {
        document.getElementById('refresh-health-btn').addEventListener('click', async () => {
            try {
                this.app.showLoading(true, 'Refreshing health status...');
                await this.render();
                this.app.showToast('Health status refreshed', 'success');
            } catch (error) {
                this.app.showToast('Failed to refresh health status', 'error');
            } finally {
                this.app.showLoading(false);
            }
        });

        document.getElementById('export-health-btn').addEventListener('click', async () => {
            try {
                const response = await this.app.api.get('/health/export?format=csv');
                if (response.success) {
                    // Create download link
                    const blob = new Blob([response.data], { type: 'text/csv' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `health_report_${new Date().toISOString().split('T')[0]}.csv`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                    this.app.showToast('Health report exported', 'success');
                }
            } catch (error) {
                this.app.showToast('Failed to export health report', 'error');
            }
        });

        document.getElementById('start-monitoring-btn').addEventListener('click', async () => {
            try {
                await this.app.api.post('/health/monitoring/start');
                this.app.showToast('Health monitoring started', 'success');
            } catch (error) {
                this.app.showToast('Failed to start monitoring', 'error');
            }
        });
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SystemHealthManagement;
} else {
    // For browser usage
    window.SystemHealthManagement = SystemHealthManagement;
}