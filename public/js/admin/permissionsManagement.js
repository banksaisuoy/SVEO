// VisionHub - Permissions Management Module
// This file contains permissions management functionality for the admin panel

class PermissionsManagement {
    constructor(app) {
        this.app = app;
    }

    async render() {
        const adminContent = document.getElementById('admin-content');

        try {
            const [permissionsResponse, groupsResponse, usersResponse] = await Promise.all([
                this.app.api.get('/permissions'),
                this.app.api.get('/groups'),
                this.app.api.get('/users')
            ]);

            const permissions = permissionsResponse.success ? permissionsResponse.permissions : {};
            const groups = groupsResponse.success ? groupsResponse.groups : [];
            const users = usersResponse.success ? usersResponse.users : [];

            const permissionsHtml = `
                <div class="space-y-6">
                    <div class="flex justify-between items-center">
                        <h3 class="text-xl font-bold">Permission Matrix</h3>
                        <div class="flex gap-2">
                            <button id="manage-user-permissions-btn" class="btn btn-secondary">Manage User Permissions</button>
                            <button id="manage-group-permissions-btn" class="btn btn-secondary">Manage Group Permissions</button>
                        </div>
                    </div>

                    ${Object.keys(permissions).map(category => `
                        <div class="card">
                            <h4 class="text-lg font-semibold mb-3 capitalize">${category} Permissions</h4>
                            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                ${permissions[category].map(permission => `
                                    <div class="permission-item p-3 border rounded-lg">
                                        <div class="font-medium">${permission.name}</div>
                                        <div class="text-sm text-muted">${permission.description}</div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;

            adminContent.innerHTML = permissionsHtml;

            // Event listeners
            document.getElementById('manage-user-permissions-btn').addEventListener('click', () => {
                this.showUserPermissionsModal(users, permissions);
            });
            document.getElementById('manage-group-permissions-btn').addEventListener('click', () => {
                this.showGroupPermissionsModal(groups, permissions);
            });
        } catch (error) {
            console.error('Error rendering permissions management:', error);
            adminContent.innerHTML = '<div class="text-center text-error">Error loading permissions</div>';
        }
    }

    showUserPermissionsModal(users, permissions) {
        // This would show a modal for managing user permissions
        const modalHtml = `
            <div class="modal-content">
                <h3 class="modal-title">Manage User Permissions</h3>
                <div class="space-y-4">
                    <p>User permissions functionality would be implemented here</p>
                </div>
                <div class="modal-footer">
                    <button id="close-modal" class="btn btn-secondary">Close</button>
                </div>
            </div>
        `;

        this.app.showModal(modalHtml);
        document.getElementById('close-modal').onclick = () => this.app.hideModal();
    }

    showGroupPermissionsModal(groups, permissions) {
        // This would show a modal for managing group permissions
        const modalHtml = `
            <div class="modal-content">
                <h3 class="modal-title">Manage Group Permissions</h3>
                <div class="space-y-4">
                    <p>Group permissions functionality would be implemented here</p>
                </div>
                <div class="modal-footer">
                    <button id="close-modal" class="btn btn-secondary">Close</button>
                </div>
            </div>
        `;

        this.app.showModal(modalHtml);
        document.getElementById('close-modal').onclick = () => this.app.hideModal();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PermissionsManagement;
}