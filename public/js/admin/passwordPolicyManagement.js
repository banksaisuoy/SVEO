// VisionHub - Password Policy Management Module
// This file contains password policy management functionality for the admin panel

class PasswordPolicyManagement {
    constructor(app) {
        this.app = app;
    }

    async render() {
        const adminContent = document.getElementById('admin-content');

        try {
            const [activePolicyResponse, allPoliciesResponse] = await Promise.all([
                this.app.api.get('/password-policies/active'),
                this.app.api.get('/password-policies')
            ]);

            const activePolicy = activePolicyResponse.success ? activePolicyResponse.policy : null;
            const allPolicies = allPoliciesResponse.success ? allPoliciesResponse.policies : [];

            const policyHtml = `
                <div class="space-y-6">
                    <div class="flex justify-between items-center">
                        <h3 class="text-xl font-bold">Password Policy Management</h3>
                        <button id="create-policy-btn" class="btn btn-primary">Create New Policy</button>
                    </div>

                    ${activePolicy ? `
                        <div class="card border-success">
                            <div class="flex items-center mb-3">
                                <span class="badge badge-success mr-2">ACTIVE</span>
                                <h4 class="text-lg font-semibold">${activePolicy.name}</h4>
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div>
                                    <label class="text-sm font-medium">Minimum Length</label>
                                    <p class="text-lg">${activePolicy.min_length} characters</p>
                                </div>
                                <div>
                                    <label class="text-sm font-medium">Requirements</label>
                                    <div class="space-y-1">
                                        ${activePolicy.require_uppercase ? '<span class="badge badge-success">Uppercase</span>' : '<span class="badge badge-secondary">No Uppercase</span>'}
                                        ${activePolicy.require_lowercase ? '<span class="badge badge-success">Lowercase</span>' : '<span class="badge badge-secondary">No Lowercase</span>'}
                                        ${activePolicy.require_numbers ? '<span class="badge badge-success">Numbers</span>' : '<span class="badge badge-secondary">No Numbers</span>'}
                                        ${activePolicy.require_special_chars ? '<span class="badge badge-success">Special Chars</span>' : '<span class="badge badge-secondary">No Special Chars</span>'}
                                    </div>
                                </div>
                                <div>
                                    <label class="text-sm font-medium">Password Age</label>
                                    <p class="text-lg">${activePolicy.max_age_days} days</p>
                                </div>
                                <div>
                                    <label class="text-sm font-medium">Lockout Settings</label>
                                    <p class="text-sm">${activePolicy.lockout_attempts} attempts</p>
                                    <p class="text-sm">${activePolicy.lockout_duration_minutes} min lockout</p>
                                </div>
                            </div>
                        </div>
                    ` : `
                        <div class="card border-warning">
                            <div class="text-center text-warning">
                                <h4 class="text-lg font-semibold">No Active Password Policy</h4>
                                <p>Create a password policy to enforce security requirements.</p>
                            </div>
                        </div>
                    `}

                    <div class="card">
                        <h4 class="text-lg font-semibold mb-4">All Password Policies</h4>
                        <div class="table-container">
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th>Policy Name</th>
                                        <th>Min Length</th>
                                        <th>Requirements</th>
                                        <th>Status</th>
                                        <th>Created</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${allPolicies.map(policy => `
                                        <tr>
                                            <td class="font-medium">${policy.name}</td>
                                            <td>${policy.min_length} chars</td>
                                            <td>
                                                <div class="flex gap-1">
                                                    ${policy.require_uppercase ? '<span class="badge badge-success">A</span>' : ''}
                                                    ${policy.require_lowercase ? '<span class="badge badge-success">a</span>' : ''}
                                                    ${policy.require_numbers ? '<span class="badge badge-success">1</span>' : ''}
                                                    ${policy.require_special_chars ? '<span class="badge badge-success">@</span>' : ''}
                                                </div>
                                            </td>
                                            <td>
                                                ${policy.is_active ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-secondary">Inactive</span>'}
                                            </td>
                                            <td>${new Date(policy.created_at).toLocaleDateString()}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;

            adminContent.innerHTML = policyHtml;

            // Event listeners
            document.getElementById('create-policy-btn').addEventListener('click', () => this.showPasswordPolicyForm());
        } catch (error) {
            console.error('Error rendering password policy management:', error);
            adminContent.innerHTML = '<div class="text-center text-error">Error loading password policies</div>';
        }
    }

    showPasswordPolicyForm() {
        const modalHtml = `
            <div class="modal-content" style="max-width: 32rem;">
                <h3 class="modal-title">Create Password Policy</h3>
                <form id="policy-form" class="space-y-4">
                    <div class="form-group">
                        <label for="policy-name" class="form-label">Policy Name</label>
                        <input type="text" id="policy-name" class="form-input" required>
                    </div>

                    <div class="form-group">
                        <label for="min-length" class="form-label">Minimum Length</label>
                        <input type="number" id="min-length" value="8" min="4" max="64" class="form-input" required>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Requirements</label>
                        <div class="space-y-2">
                            <label class="flex items-center">
                                <input type="checkbox" id="require-uppercase" checked class="form-checkbox">
                                <span class="ml-2">Require uppercase letters</span>
                            </label>
                            <label class="flex items-center">
                                <input type="checkbox" id="require-lowercase" checked class="form-checkbox">
                                <span class="ml-2">Require lowercase letters</span>
                            </label>
                            <label class="flex items-center">
                                <input type="checkbox" id="require-numbers" checked class="form-checkbox">
                                <span class="ml-2">Require numbers</span>
                            </label>
                            <label class="flex items-center">
                                <input type="checkbox" id="require-special" checked class="form-checkbox">
                                <span class="ml-2">Require special characters</span>
                            </label>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div class="form-group">
                            <label for="max-age" class="form-label">Password Max Age (days)</label>
                            <input type="number" id="max-age" value="90" min="1" class="form-input">
                        </div>
                        <div class="form-group">
                            <label for="history-count" class="form-label">Password History</label>
                            <input type="number" id="history-count" value="5" min="0" class="form-input">
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div class="form-group">
                            <label for="lockout-attempts" class="form-label">Lockout Attempts</label>
                            <input type="number" id="lockout-attempts" value="5" min="1" class="form-input">
                        </div>
                        <div class="form-group">
                            <label for="lockout-duration" class="form-label">Lockout Duration (min)</label>
                            <input type="number" id="lockout-duration" value="30" min="1" class="form-input">
                        </div>
                    </div>

                    <div class="modal-footer">
                        <button type="button" id="cancel-btn" class="btn btn-secondary">Cancel</button>
                        <button type="submit" class="btn btn-primary">Create Policy</button>
                    </div>
                </form>
            </div>
        `;

        this.app.showModal(modalHtml);

        document.getElementById('policy-form').addEventListener('submit', (e) => this.handlePasswordPolicyFormSubmit(e));
        document.getElementById('cancel-btn').onclick = () => this.app.hideModal();
    }

    async handlePasswordPolicyFormSubmit(event) {
        event.preventDefault();

        const policyData = {
            name: document.getElementById('policy-name').value,
            min_length: parseInt(document.getElementById('min-length').value),
            require_uppercase: document.getElementById('require-uppercase').checked,
            require_lowercase: document.getElementById('require-lowercase').checked,
            require_numbers: document.getElementById('require-numbers').checked,
            require_special_chars: document.getElementById('require-special').checked,
            max_age_days: parseInt(document.getElementById('max-age').value),
            history_count: parseInt(document.getElementById('history-count').value),
            lockout_attempts: parseInt(document.getElementById('lockout-attempts').value),
            lockout_duration_minutes: parseInt(document.getElementById('lockout-duration').value)
        };

        try {
            await this.app.api.post('/password-policies', policyData);
            this.app.showToast('Password policy created and activated successfully', 'success');
            this.app.hideModal();
            this.render();
        } catch (error) {
            console.error('Error creating password policy:', error);
            this.app.showToast('Error creating password policy', 'error');
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PasswordPolicyManagement;
}