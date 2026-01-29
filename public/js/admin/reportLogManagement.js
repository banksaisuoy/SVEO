// VisionHub - Report & Log Management Module
// This file contains report and log management functionality for the admin panel

class ReportLogManagement {
    constructor(app) {
        this.app = app;
    }

    async render() {
        const adminContent = document.getElementById('admin-content');

        try {
            const [reportsResponse, logsResponse] = await Promise.all([
                this.app.api.get('/reports'),
                this.app.api.get('/logs?limit=50')
            ]);

            const reports = reportsResponse.success ? reportsResponse.reports : [];
            const logs = logsResponse.success ? logsResponse.logs : [];

            const reportsHtml = `
                <div class="card mb-6">
                    <h3 class="text-xl font-bold mb-4">Video Reports</h3>
                    ${reports.length > 0 ? `
                        <div class="table-container">
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th>Video</th>
                                        <th>Reason</th>
                                        <th>Reporter</th>
                                        <th>Date</th>
                                        <th class="text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${reports.map(report => `
                                        <tr>
                                            <td>${report.videoTitle || `ID: ${report.videoId}`}</td>
                                            <td>${report.reason}</td>
                                            <td>${report.userId}</td>
                                            <td>${new Date(report.created_at).toLocaleDateString()}</td>
                                            <td class="text-right">
                                                <button class="btn btn-sm btn-success resolve-report-btn" data-id="${report.id}">
                                                    Resolve
                                                </button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : '<p class="text-muted">No reports at this time</p>'}
                </div>

                <div class="card">
                    <h3 class="text-xl font-bold mb-4">Recent Activity Logs</h3>
                    ${logs.length > 0 ? `
                        <div class="table-container">
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th>User</th>
                                        <th>Action</th>
                                        <th>Details</th>
                                        <th>Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${logs.map(log => `
                                        <tr>
                                            <td>${log.userId}</td>
                                            <td class="font-medium">${log.action}</td>
                                            <td class="text-sm">${log.details}</td>
                                            <td>${new Date(log.created_at).toLocaleDateString()}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : '<p class="text-muted">No activity logs</p>'}
                </div>
            `;

            adminContent.innerHTML = reportsHtml;

            document.querySelectorAll('.resolve-report-btn').forEach(btn => {
                btn.addEventListener('click', (e) => this.handleResolveReport(e));
            });
        } catch (error) {
            console.error('Error rendering reports and logs:', error);
            adminContent.innerHTML = '<div class="text-center text-error">Error loading reports and logs</div>';
        }
    }

    async handleResolveReport(event) {
        const reportId = event.currentTarget.dataset.id;

        try {
            await this.app.api.delete(`/reports/${reportId}`);
            this.app.showToast('Report resolved successfully', 'success');
            this.render();
        } catch (error) {
            console.error('Error resolving report:', error);
            this.app.showToast('Error resolving report', 'error');
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReportLogManagement;
}