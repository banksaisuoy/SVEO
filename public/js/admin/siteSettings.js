// VisionHub - Site Settings Module
// This file contains site settings functionality for the admin panel

class SiteSettings {
    constructor(app) {
        this.app = app;
    }

    render() {
        const adminContent = document.getElementById('admin-content');

        const settingsHtml = `
            <form id="settings-form" class="space-y-4">
                <div class="form-group">
                    <label for="site-name" class="form-label">Site Name</label>
                    <input type="text" id="site-name" value="${this.app.state.siteSettings.siteName}" class="form-input">
                </div>
                <div class="form-group">
                    <label for="primary-color" class="form-label">Primary Color</label>
                    <input type="color" id="primary-color" value="${this.app.state.siteSettings.primaryColor}" class="form-input">
                </div>
                <div class="flex justify-end">
                    <button type="submit" class="btn btn-primary">Save Settings</button>
                </div>
            </form>
        `;

        adminContent.innerHTML = settingsHtml;
        document.getElementById('settings-form').addEventListener('submit', (e) => this.handleSaveSettings(e));
    }

    async handleSaveSettings(event) {
        event.preventDefault();
        const siteName = document.getElementById('site-name').value;
        const primaryColor = document.getElementById('primary-color').value;

        try {
            await this.app.api.post('/settings', { siteName, primaryColor });
            this.app.state.siteSettings.siteName = siteName;
            this.app.state.siteSettings.primaryColor = primaryColor;
            this.app.applySettings();
            this.app.showToast('Settings saved successfully', 'success');
        } catch (error) {
            console.error('Error saving settings:', error);
            this.app.showToast('Error saving settings', 'error');
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SiteSettings;
}