// VisionHub - User Management Module
// This file contains user management functionality for the admin panel

class UserManagement {
    constructor(app) {
        this.app = app;
    }

    async render() {
        const adminContent = document.getElementById('admin-content');

        try {
            const response = await this.app.api.get('/users');
            const users = response.success ? response.users : [];

            const tableHtml = `
                <div class="flex justify-end mb-4">
                    <button id="add-user-btn" class="btn btn-primary">Add New User</button>
                </div>
                <div class="table-container">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Username</th>
                                <th>Role</th>
                                <th>Created</th>
                                <th class="text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${users.map(user => `
                                <tr>
                                    <td class="font-medium">${user.username}</td>
                                    <td>
                                        <span class="badge ${user.role === 'admin' ? 'badge-admin' : 'badge-user'}">
                                            ${user.role.toUpperCase()}
                                        </span>
                                    </td>
                                    <td>${new Date(user.created_at).toLocaleDateString()}</td>
                                    <td class="text-right">
                                        <div class="action-buttons">
                                            <button class="btn btn-sm btn-secondary change-role-btn" data-username="${user.username}" data-role="${user.role}">
                                                Change Role
                                            </button>
                                            <button class="btn btn-sm btn-warning change-password-btn" data-username="${user.username}">
                                                Change Password
                                            </button>
                                            <button class="btn btn-sm btn-info manage-profile-btn" data-username="${user.username}">
                                                Manage Profile
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;

            adminContent.innerHTML = tableHtml;

            document.getElementById('add-user-btn').addEventListener('click', () => this.showUserForm());
            document.querySelectorAll('.change-role-btn').forEach(btn => {
                btn.addEventListener('click', (e) => this.handleChangeRole(e));
            });
            document.querySelectorAll('.change-password-btn').forEach(btn => {
                btn.addEventListener('click', (e) => this.handleChangePassword(e));
            });
            document.querySelectorAll('.manage-profile-btn').forEach(btn => {
                btn.addEventListener('click', (e) => this.handleManageProfile(e));
            });
        } catch (error) {
            console.error('Error rendering user management:', error);
            adminContent.innerHTML = '<div class="text-center text-error">Error loading users</div>';
        }
    }

    async handleChangeRole(event) {
        const username = event.currentTarget.dataset.username;
        const currentRole = event.currentTarget.dataset.role;
        const newRole = currentRole === 'admin' ? 'user' : 'admin';

        this.app.showConfirmationModal(
            `Are you sure you want to change the role of ${username} to ${newRole}?`,
            async () => {
                try {
                    await this.app.api.patch(`/users/${username}/role`, { role: newRole });
                    this.app.showToast(`Changed role of ${username} to ${newRole}`, 'success');
                    this.render();
                } catch (error) {
                    console.error('Error changing role:', error);
                    this.app.showToast('Error changing user role', 'error');
                }
            }
        );
    }

    async handleChangePassword(event) {
        const username = event.currentTarget.dataset.username;

        const modalHtml = `
            <div class="modal-content">
                <h3 class="modal-title">Change Password for ${username}</h3>
                <form id="change-password-form" class="space-y-4">
                    <div class="form-group">
                        <label for="new-password" class="form-label">New Password</label>
                        <input type="password" id="new-password" class="form-input" required minlength="6">
                        <small class="text-muted">Password must be at least 6 characters</small>
                    </div>
                    <div class="form-group">
                        <label for="confirm-password" class="form-label">Confirm Password</label>
                        <input type="password" id="confirm-password" class="form-input" required>
                    </div>
                    <div class="modal-footer">
                        <button type="button" id="cancel-btn" class="btn btn-secondary">Cancel</button>
                        <button type="submit" class="btn btn-primary">Change Password</button>
                    </div>
                </form>
            </div>
        `;

        this.app.showModal(modalHtml);

        document.getElementById('change-password-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const newPassword = document.getElementById('new-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;

            if (newPassword !== confirmPassword) {
                this.app.showToast('Passwords do not match', 'error');
                return;
            }

            try {
                await this.app.api.patch(`/users/${username}`, { password: newPassword });
                this.app.showToast(`Password changed successfully for ${username}`, 'success');
                this.app.hideModal();
            } catch (error) {
                console.error('Error changing password:', error);
                this.app.showToast('Error changing password', 'error');
            }
        });

        document.getElementById('cancel-btn').onclick = () => this.app.hideModal();
    }

    async handleManageProfile(event) {
        const username = event.currentTarget.dataset.username;

        // First, get current user profile
        try {
            const response = await this.app.api.get(`/users/${username}`);
            const user = response.success ? response.user : {};

            const modalHtml = `
                <div class="modal-content">
                    <h3 class="modal-title">Manage Profile for ${username}</h3>
                    <form id="manage-profile-form" class="space-y-4">
                        <div class="form-group">
                            <label for="full-name" class="form-label">Full Name</label>
                            <input type="text" id="full-name" value="${user.fullName || ''}" class="form-input" placeholder="Enter full name">
                        </div>
                        <div class="form-group">
                            <label for="department" class="form-label">Department</label>
                            <input type="text" id="department" value="${user.department || ''}" class="form-input" placeholder="Enter department">
                        </div>
                        <div class="form-group">
                            <label for="employee-id" class="form-label">Employee ID</label>
                            <input type="text" id="employee-id" value="${user.employeeId || ''}" class="form-input" placeholder="Enter employee ID">
                        </div>
                        <div class="form-group">
                            <label for="email" class="form-label">Email</label>
                            <input type="email" id="email" value="${user.email || ''}" class="form-input" placeholder="Enter email address">
                        </div>
                        <div class="form-group">
                            <label for="phone" class="form-label">Phone Number</label>
                            <input type="tel" id="phone" value="${user.phone || ''}" class="form-input" placeholder="Enter phone number">
                        </div>
                        <div class="modal-footer">
                            <button type="button" id="cancel-btn" class="btn btn-secondary">Cancel</button>
                            <button type="submit" class="btn btn-primary">Save Profile</button>
                        </div>
                    </form>
                </div>
            `;

            this.app.showModal(modalHtml);

            document.getElementById('manage-profile-form').addEventListener('submit', async (e) => {
                e.preventDefault();

                const profileData = {
                    fullName: document.getElementById('full-name').value,
                    department: document.getElementById('department').value,
                    employeeId: document.getElementById('employee-id').value,
                    email: document.getElementById('email').value,
                    phone: document.getElementById('phone').value
                };

                try {
                    await this.app.api.patch(`/users/${username}`, profileData);
                    this.app.showToast(`Profile updated successfully for ${username}`, 'success');
                    this.app.hideModal();
                    this.render();
                } catch (error) {
                    console.error('Error updating profile:', error);
                    this.app.showToast('Error updating profile', 'error');
                }
            });

            document.getElementById('cancel-btn').onclick = () => this.app.hideModal();
        } catch (error) {
            console.error('Error loading user profile:', error);
            this.app.showToast('Error loading user profile', 'error');
        }
    }

    showUserForm(user = null) {
        const formTitle = user ? 'Edit User' : 'Add New User';
        const modalHtml = `
            <div class="modal-content">
                <h3 class="modal-title">${formTitle}</h3>
                <form id="user-form" class="space-y-4">
                    <div class="form-group">
                        <label for="form-username" class="form-label">Username</label>
                        <input type="text" id="form-username" value="${user ? user.username : ''}" class="form-input" required ${user ? 'disabled' : ''}>
                    </div>
                    <div class="form-group">
                        <label for="form-password" class="form-label">Password</label>
                        <input type="password" id="form-password" class="form-input" required>
                    </div>
                    <div class="form-group">
                        <label for="form-role" class="form-label">Role</label>
                        <select id="form-role" class="form-select" required>
                            <option value="user" ${user && user.role === 'user' ? 'selected' : ''}>User</option>
                            <option value="admin" ${user && user.role === 'admin' ? 'selected' : ''}>Admin</option>
                        </select>
                    </div>
                    <div class="modal-footer">
                        <button type="button" id="cancel-btn" class="btn btn-secondary">Cancel</button>
                        <button type="submit" class="btn btn-primary">Save</button>
                    </div>
                </form>
            </div>
        `;

        this.app.showModal(modalHtml);

        document.getElementById('user-form').addEventListener('submit', (e) => this.handleUserFormSubmit(e, user));
        document.getElementById('cancel-btn').onclick = () => this.app.hideModal();
    }

    async handleUserFormSubmit(event, user) {
        event.preventDefault();
        const username = document.getElementById('form-username').value;
        const password = document.getElementById('form-password').value;
        const role = document.getElementById('form-role').value;

        try {
            if (user) {
                await this.app.api.put(`/users/${username}`, { password, role });
                this.app.showToast('User updated successfully', 'success');
            } else {
                await this.app.api.post('/users', { username, password, role });
                this.app.showToast('User created successfully', 'success');
            }
            this.app.hideModal();
            this.render();
        } catch (error) {
            console.error('Error saving user:', error);
            this.app.showToast('Error saving user', 'error');
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UserManagement;
}