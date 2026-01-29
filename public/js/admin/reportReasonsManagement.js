// VisionHub - Report Reasons Management Module
// This file contains report reasons management functionality for the admin panel

class ReportReasonsManagement {
    constructor(app) {
        this.app = app;
    }

    async render() {
        const adminContent = document.getElementById('admin-content');

        try {
            const response = await this.app.api.get('/report-reasons');
            const reasons = response.success ? response.reasons : [];

            const tableHtml = `
                <div class="flex justify-between items-center mb-4">
                    <h2 class="text-2xl font-bold">Report Reasons Management</h2>
                    <div class="flex gap-2">
                        <button id="add-reason-btn" class="btn btn-sm btn-primary" title="Add New Reason">
                            <i class="fas fa-plus"></i> Add New Reason
                        </button>
                    </div>
                </div>
                <div class="table-container">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Reason Text</th>
                                <th>Created</th>
                                <th class="text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${reasons.map(reason => `
                                <tr>
                                    <td class="font-medium">${reason.reason}</td>
                                    <td>${new Date(reason.created_at).toLocaleDateString()}</td>
                                    <td class="text-right">
                                        <button class="btn btn-sm btn-secondary edit-reason-btn" data-id="${reason.id}">Edit</button>
                                        <button class="btn btn-sm btn-danger delete-reason-btn" data-id="${reason.id}">Delete</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;

            adminContent.innerHTML = tableHtml;

            // Add event listeners for the management buttons
            document.getElementById('add-reason-btn').addEventListener('click', () => this.showReasonForm());

            document.querySelectorAll('.edit-reason-btn').forEach(btn => {
                btn.addEventListener('click', (e) => this.handleEditReason(e));
            });
            document.querySelectorAll('.delete-reason-btn').forEach(btn => {
                btn.addEventListener('click', (e) => this.handleDeleteReason(e));
            });
        } catch (error) {
            console.error('Error rendering report reason management:', error);
            adminContent.innerHTML = '<div class="text-center text-error">Error loading report reasons</div>';
        }
    }

    async handleEditReason(event) {
        const reasonId = event.currentTarget.dataset.id;
        try {
            const response = await this.app.api.get(`/report-reasons/${reasonId}`);
            if (response.success) {
                this.showReasonForm(response.reason);
            }
        } catch (error) {
            console.error('Error loading reason:', error);
            this.app.showToast('Error loading reason', 'error');
        }
    }

    async handleDeleteReason(event) {
        const reasonId = event.currentTarget.dataset.id;

        this.app.showConfirmationModal(
            'Are you sure you want to delete this report reason?',
            async () => {
                try {
                    await this.app.api.delete(`/report-reasons/${reasonId}`);
                    this.app.showToast('Report reason deleted successfully', 'success');
                    this.render();
                } catch (error) {
                    console.error('Error deleting reason:', error);
                    this.app.showToast('Error deleting reason', 'error');
                }
            }
        );
    }

    showReasonForm(reason = null) {
        const formTitle = reason ? 'Edit Report Reason' : 'Add New Report Reason';
        const modalHtml = `
            <div class="modal-content">
                <h3 class="modal-title">${formTitle}</h3>
                <form id="reason-form" class="space-y-4">
                    <input type="hidden" id="reason-id" value="${reason ? reason.id : ''}">
                    <div class="form-group">
                        <label for="form-reason-text" class="form-label">Reason Text</label>
                        <input type="text" id="form-reason-text" value="${reason ? reason.reason : ''}" class="form-input" required>
                    </div>
                    <div class="modal-footer">
                        <button type="button" id="cancel-btn" class="btn btn-secondary">Cancel</button>
                        <button type="submit" class="btn btn-primary">Save</button>
                    </div>
                </form>
            </div>
        `;

        this.app.showModal(modalHtml);

        document.getElementById('reason-form').addEventListener('submit', (e) => this.handleReasonFormSubmit(e, reason));
        document.getElementById('cancel-btn').onclick = () => this.app.hideModal();
    }

    async handleReasonFormSubmit(event, reason) {
        event.preventDefault();
        const reasonId = document.getElementById('reason-id').value;
        const reasonText = document.getElementById('form-reason-text').value;

        try {
            if (reason) {
                await this.app.api.put(`/report-reasons/${reasonId}`, { reason: reasonText });
                this.app.showToast('Report reason updated successfully', 'success');
            } else {
                await this.app.api.post('/report-reasons', { reason: reasonText });
                this.app.showToast('Report reason created successfully', 'success');
            }

            this.app.hideModal();
            this.render();
        } catch (error) {
            console.error('Error saving reason:', error);
            this.app.showToast('Error saving reason', 'error');
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReportReasonsManagement;
}