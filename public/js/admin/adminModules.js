// VisionHub - Admin Modules Loader
// This file loads and manages all admin modules

class AdminModules {
    constructor(app) {
        this.app = app;
        this.modules = {};

        // Check if modules are available in global scope (browser environment)
        if (typeof UserManagement !== 'undefined') {
            this.modules.users = new UserManagement(app);
        }
        if (typeof VideoManagement !== 'undefined') {
            this.modules.videos = new VideoManagement(app);
        }
        if (typeof CategoryManagement !== 'undefined') {
            this.modules.categories = new CategoryManagement(app);
        }
        if (typeof ReportLogManagement !== 'undefined') {
            this.modules.reports = new ReportLogManagement(app);
        }
        if (typeof SiteSettings !== 'undefined') {
            this.modules.settings = new SiteSettings(app);
        }
        if (typeof GroupsManagement !== 'undefined') {
            this.modules.groups = new GroupsManagement(app);
        }
        if (typeof PermissionsManagement !== 'undefined') {
            this.modules.permissions = new PermissionsManagement(app);
        }
        if (typeof PasswordPolicyManagement !== 'undefined') {
            this.modules['password-policy'] = new PasswordPolicyManagement(app);
        }
        if (typeof ReportReasonsManagement !== 'undefined') {
            this.modules['report-reasons'] = new ReportReasonsManagement(app);
        }
        if (typeof AIFeaturesManagement !== 'undefined') {
            this.modules['ai-features'] = new AIFeaturesManagement(app);
        }
        if (typeof AISettingsManagement !== 'undefined') {
            this.modules['ai-settings'] = new AISettingsManagement(app);
        }
        if (typeof VideoCompressionManagement !== 'undefined') {
            this.modules['video-compression'] = new VideoCompressionManagement(app);
        }
        if (typeof SystemHealthManagement !== 'undefined') {
            this.modules['system-health'] = new SystemHealthManagement(app);
        }
        if (typeof BackupSystemManagement !== 'undefined') {
            this.modules['backup-system'] = new BackupSystemManagement(app);
        }
    }

    // Render the appropriate admin module based on the current tab
    renderModule(tab) {
        const adminContent = document.getElementById('admin-content');

        // Show loading message while we check for the module
        adminContent.innerHTML = '<div class="text-center">Loading admin module...</div>';

        // Use setTimeout to allow DOM to update before rendering
        setTimeout(() => {
            const module = this.modules[tab];
            if (module && typeof module.render === 'function') {
                try {
                    module.render();
                } catch (error) {
                    console.error(`Error rendering module ${tab}:`, error);
                    adminContent.innerHTML = `<div class="text-center text-error">Error loading module: ${error.message}</div>`;
                }
            } else {
                // Show more specific error message
                const moduleNames = {
                    'ai-features': 'AI Features',
                    'ai-settings': 'AI Settings',
                    'video-compression': 'Video Compression',
                    'system-health': 'System Health',
                    'backup-system': 'Backup System',
                    'report-reasons': 'Report Reasons',
                    'password-policy': 'Password Policy',
                    'users': 'User Management',
                    'videos': 'Video Management',
                    'categories': 'Category Management',
                    'reports': 'Reports & Logs',
                    'groups': 'Groups & Teams',
                    'permissions': 'Permissions',
                    'settings': 'Site Settings'
                };

                const moduleName = moduleNames[tab] || tab;
                adminContent.innerHTML = `<div class="text-center text-error">Module "${moduleName}" not found or not properly loaded. Please check that all required JavaScript files are included.</div>`;
            }
        }, 0);
    }

    // Get a specific module instance
    getModule(tab) {
        return this.modules[tab];
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdminModules;
} else {
    // For browser usage
    window.AdminModules = AdminModules;
}