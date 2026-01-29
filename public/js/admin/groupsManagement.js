// VisionHub - Groups Management Module
// This file contains groups management functionality for the admin panel

class GroupsManagement {
    constructor(app) {
        this.app = app;
    }

    async render() {
        const adminContent = document.getElementById('admin-content');

        try {
            const response = await this.app.api.get('/groups');
            const groups = response.success ? response.groups : [];

            const tableHtml = `
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-xl font-bold">Groups & Teams Management</h3>
                    <button id="add-group-btn" class="btn btn-primary">Create New Group</button>
                </div>
                <div class="table-container">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Group Name</th>
                                <th>Description</th>
                                <th>Members</th>
                                <th>Created</th>
                                <th class="text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${groups.map(group => `
                                <tr>
                                    <td>
                                        <div class="flex items-center">
                                            <div class="w-4 h-4 rounded-full mr-2" style="background-color: ${group.color}"></div>
                                            <span class="font-medium">${group.name}</span>
                                        </div>
                                    </td>
                                    <td class="text-sm text-muted">${group.description || 'No description'}</td>
                                    <td>
                                        <span class="badge badge-user">${group.member_count} members</span>
                                    </td>
                                    <td>${new Date(group.created_at).toLocaleDateString()}</td>
                                    <td class="text-right">
                                        <div class="action-buttons">
                                            <button class="btn btn-sm btn-info view-group-btn" data-id="${group.id}">Members</button>
                                            <button class="btn btn-sm btn-secondary edit-group-btn" data-id="${group.id}">Edit</button>
                                            <button class="btn btn-sm btn-danger delete-group-btn" data-id="${group.id}">Delete</button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;

            adminContent.innerHTML = tableHtml;

            // Event listeners
            document.getElementById('add-group-btn').addEventListener('click', () => this.showGroupForm());
            document.querySelectorAll('.view-group-btn').forEach(btn => {
                btn.addEventListener('click', (e) => this.handleViewGroupMembers(e));
            });
            document.querySelectorAll('.edit-group-btn').forEach(btn => {
                btn.addEventListener('click', (e) => this.handleEditGroup(e));
            });
            document.querySelectorAll('.delete-group-btn').forEach(btn => {
                btn.addEventListener('click', (e) => this.handleDeleteGroup(e));
            });
        } catch (error) {
            console.error('Error rendering groups management:', error);
            adminContent.innerHTML = '<div class="text-center text-error">Error loading groups</div>';
        }
    }

    async handleViewGroupMembers(event) {
        const groupId = event.currentTarget.dataset.id;

        try {
            const response = await this.app.api.get(`/groups/${groupId}`);
            if (response.success) {
                this.showGroupMembersModal(response.group);
            }
        } catch (error) {
            console.error('Error loading group members:', error);
            this.app.showToast('Error loading group members', 'error');
        }
    }

    async handleEditGroup(event) {
        const groupId = event.currentTarget.dataset.id;

        try {
            const response = await this.app.api.get(`/groups/${groupId}`);
            if (response.success) {
                this.showGroupForm(response.group);
            }
        } catch (error) {
            console.error('Error loading group:', error);
            this.app.showToast('Error loading group', 'error');
        }
    }

    async handleDeleteGroup(event) {
        const groupId = event.currentTarget.dataset.id;

        this.app.showConfirmationModal(
            'Are you sure you want to delete this group? All group memberships will be removed.',
            async () => {
                try {
                    await this.app.api.delete(`/groups/${groupId}`);
                    this.app.showToast('Group deleted successfully', 'success');
                    this.render();
                } catch (error) {
                    console.error('Error deleting group:', error);
                    this.app.showToast('Error deleting group', 'error');
                }
            }
        );
    }

    showGroupForm(group = null) {
        const formTitle = group ? 'Edit Group' : 'Create New Group';
        const modalHtml = `
            <div class="modal-content">
                <h3 class="modal-title">${formTitle}</h3>
                <form id="group-form" class="space-y-4">
                    <input type="hidden" id="group-id" value="${group ? group.id : ''}">
                    <div class="form-group">
                        <label for="group-name" class="form-label">Group Name</label>
                        <input type="text" id="group-name" value="${group ? group.name : ''}" class="form-input" required>
                    </div>
                    <div class="form-group">
                        <label for="group-description" class="form-label">Description</label>
                        <textarea id="group-description" class="form-textarea" rows="3">${group ? group.description || '' : ''}</textarea>
                    </div>
                    <div class="form-group">
                        <label for="group-color" class="form-label">Group Color</label>
                        <input type="color" id="group-color" value="${group ? group.color : '#2a9d8f'}" class="form-input">
                    </div>
                    <div class="modal-footer">
                        <button type="button" id="cancel-btn" class="btn btn-secondary">Cancel</button>
                        <button type="submit" class="btn btn-primary">Save Group</button>
                    </div>
                </form>
            </div>
        `;

        this.app.showModal(modalHtml);

        document.getElementById('group-form').addEventListener('submit', (e) => this.handleGroupFormSubmit(e, group));
        document.getElementById('cancel-btn').onclick = () => this.app.hideModal();
    }

    async handleGroupFormSubmit(event, group) {
        event.preventDefault();
        const groupId = document.getElementById('group-id').value;
        const name = document.getElementById('group-name').value;
        const description = document.getElementById('group-description').value;
        const color = document.getElementById('group-color').value;

        try {
            const groupData = { name, description, color };

            if (group) {
                await this.app.api.put(`/groups/${groupId}`, groupData);
                this.app.showToast('Group updated successfully', 'success');
            } else {
                await this.app.api.post('/groups', groupData);
                this.app.showToast('Group created successfully', 'success');
            }

            this.app.hideModal();
            this.render();
        } catch (error) {
            console.error('Error saving group:', error);
            this.app.showToast('Error saving group', 'error');
        }
    }

    showGroupMembersModal(group) {
        // This would show a modal with group members
        // Implementation would depend on the specific UI requirements
        const modalHtml = `
            <div class="modal-content">
                <h3 class="modal-title">Members of ${group.name}</h3>
                <div class="space-y-2">
                    <!-- Group members would be listed here -->
                    <p>Group member functionality would be implemented here</p>
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
    module.exports = GroupsManagement;
}