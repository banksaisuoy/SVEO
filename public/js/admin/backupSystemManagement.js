// VisionHub - Backup System Management Module
// This file contains backup system functionality for the admin panel

class BackupSystemManagement {
    constructor(app) {
        this.app = app;
    }

    // Render Backup System Management
    async render() {
        const adminContent = document.getElementById('admin-content');

        try {
            const [statusResponse, backupsResponse] = await Promise.all([
                this.app.api.get('/backups/status'),
                this.app.api.get('/backups/list')
            ]);

            const backupStatus = statusResponse.success ? statusResponse.backup : {};
            const backupsList = backupsResponse.success ? backupsResponse.backups.backups : [];

            const backupHtml = `
                <div class="space-y-6">
                    <div class="flex justify-between items-center">
                        <h3 class="text-xl font-bold">Backup System</h3>
                        <div class="flex gap-2">
                            <button id="backup-database-btn" class="btn btn-secondary">Backup Database</button>
                            <button id="backup-files-btn" class="btn btn-secondary">Backup Files</button>
                            <button id="backup-full-btn" class="btn btn-primary">Full Backup</button>
                            <button id="refresh-backups-btn" class="btn btn-info">Refresh</button>
                        </div>
                    </div>

                    <!-- Backup Status -->
                    <div class="card">
                        <h4 class="text-lg font-semibold mb-3">Backup System Status</h4>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div class="feature-status">
                                <label class="text-sm font-medium">Backup Directory</label>
                                <p>${backupStatus.backupPath || 'N/A'}</p>
                            </div>
                            <div class="feature-status">
                                <label class="text-sm font-medium">Database Path</label>
                                <p>${backupStatus.dbPath || 'N/A'}</p>
                            </div>
                            <div class="feature-status">
                                <label class="text-sm font-medium">Uploads Path</label>
                                <p>${backupStatus.uploadsPath || 'N/A'}</p>
                            </div>
                            <div class="feature-status">
                                <label class="text-sm font-medium">Schedule</label>
                                <p>${backupStatus.scheduleEnabled ? backupStatus.backupSchedule : 'Not scheduled'}</p>
                            </div>
                        </div>
                    </div>

                    <!-- Backup List -->
                    <div class="card">
                        <div class="flex justify-between items-center mb-3">
                            <h4 class="text-lg font-semibold">Available Backups (${backupsList.length})</h4>
                            <div class="text-sm text-muted">
                                Showing latest 20 backups
                            </div>
                        </div>

                        ${backupsList.length > 0 ? `
                            <div class="table-container">
                                <table class="table">
                                    <thead>
                                        <tr>
                                            <th>Filename</th>
                                            <th>Type</th>
                                            <th>Size</th>
                                            <th>Created</th>
                                            <th class="text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${backupsList.slice(0, 20).map(backup => `
                                            <tr>
                                                <td class="font-mono text-sm">${backup.filename}</td>
                                                <td>
                                                    <span class="badge ${backup.type === 'database' ? 'badge-success' : 'badge-info'}">
                                                        ${backup.type}
                                                    </span>
                                                </td>
                                                <td>${Math.round(backup.size / 1024)} KB</td>
                                                <td>${new Date(backup.created).toLocaleString()}</td>
                                                <td class="text-right">
                                                    <div class="action-buttons">
                                                        ${backup.type === 'database' ?
                                                            `<button class="btn btn-sm btn-info restore-backup-btn" data-filename="${backup.filename}">Restore</button>` : ''}
                                                        <button class="btn btn-sm btn-danger delete-backup-btn" data-filename="${backup.filename}">Delete</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        ` : `
                            <div class="text-center text-muted py-8">
                                <p>No backups available</p>
                                <p class="text-sm mt-2">Create your first backup using the buttons above</p>
                            </div>
                        `}
                    </div>

                    <!-- Results Display -->
                    <div id="backup-results" class="hidden">
                        <div class="card">
                            <h4 class="text-lg font-semibold mb-3">Backup Results</h4>
                            <div id="backup-results-content"></div>
                        </div>
                    </div>
                </div>
            `;

            adminContent.innerHTML = backupHtml;

            // Event listeners
            this.setupEventHandlers();
        } catch (error) {
            console.error('Error rendering backup system:', error);
            adminContent.innerHTML = '<div class="text-center text-error">Error loading backup system</div>';
        }
    }

    // Setup Backup Event Handlers
    setupEventHandlers() {
        // Backup database button
        document.getElementById('backup-database-btn').addEventListener('click', async () => {
            try {
                this.app.showLoading(true, 'Creating database backup...');
                const response = await this.app.api.post('/backups/database');
                this.displayBackupResults('Database Backup', response);
                if (response.success) {
                    this.app.showToast('Database backup created successfully!', 'success');
                    await this.render(); // Refresh the backup list
                }
            } catch (error) {
                console.error('Database backup error:', error);
                this.app.showToast('Error creating database backup', 'error');
            } finally {
                this.app.showLoading(false);
            }
        });

        // Backup files button
        document.getElementById('backup-files-btn').addEventListener('click', async () => {
            try {
                this.app.showLoading(true, 'Creating file backup...');
                const response = await this.app.api.post('/backups/files');
                this.displayBackupResults('File Backup', response);
                if (response.success) {
                    this.app.showToast('File backup created successfully!', 'success');
                    await this.render(); // Refresh the backup list
                }
            } catch (error) {
                console.error('File backup error:', error);
                this.app.showToast('Error creating file backup', 'error');
            } finally {
                this.app.showLoading(false);
            }
        });

        // Full backup button
        document.getElementById('backup-full-btn').addEventListener('click', async () => {
            try {
                this.app.showLoading(true, 'Creating full backup...');
                const response = await this.app.api.post('/backups/full');
                this.displayBackupResults('Full Backup', response);
                if (response.success) {
                    this.app.showToast('Full backup created successfully!', 'success');
                    await this.render(); // Refresh the backup list
                }
            } catch (error) {
                console.error('Full backup error:', error);
                this.app.showToast('Error creating full backup', 'error');
            } finally {
                this.app.showLoading(false);
            }
        });

        // Refresh backups button
        document.getElementById('refresh-backups-btn').addEventListener('click', async () => {
            try {
                this.app.showLoading(true, 'Refreshing backup list...');
                await this.render();
                this.app.showToast('Backup list refreshed', 'success');
            } catch (error) {
                this.app.showToast('Failed to refresh backup list', 'error');
            } finally {
                this.app.showLoading(false);
            }
        });

        // Restore backup buttons
        document.querySelectorAll('.restore-backup-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const filename = e.currentTarget.dataset.filename;

                this.app.showConfirmationModal(
                    `Are you sure you want to restore the database from backup "${filename}"? This will overwrite the current database.`,
                    async () => {
                        try {
                            this.app.showLoading(true, 'Restoring database...');
                            const response = await this.app.api.post(`/backups/restore/${filename}`);
                            this.displayBackupResults('Database Restore', response);
                            if (response.success) {
                                this.app.showToast('Database restored successfully!', 'success');
                                await this.render(); // Refresh the backup list
                            }
                        } catch (error) {
                            console.error('Database restore error:', error);
                            this.app.showToast('Error restoring database', 'error');
                        } finally {
                            this.app.showLoading(false);
                        }
                    }
                );
            });
        });

        // Delete backup buttons
        document.querySelectorAll('.delete-backup-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const filename = e.currentTarget.dataset.filename;

                this.app.showConfirmationModal(
                    `Are you sure you want to delete backup "${filename}"? This action cannot be undone.`,
                    async () => {
                        try {
                            this.app.showLoading(true, 'Deleting backup...');
                            const response = await this.app.api.delete(`/backups/${filename}`);
                            if (response.success) {
                                this.app.showToast('Backup deleted successfully!', 'success');
                                await this.render(); // Refresh the backup list
                            } else {
                                this.app.showToast(response.error || 'Failed to delete backup', 'error');
                            }
                        } catch (error) {
                            console.error('Delete backup error:', error);
                            this.app.showToast('Error deleting backup', 'error');
                        } finally {
                            this.app.showLoading(false);
                        }
                    }
                );
            });
        });
    }

    // Display Backup Results
    displayBackupResults(title, response) {
        const resultsDiv = document.getElementById('backup-results');
        const contentDiv = document.getElementById('backup-results-content');

        let resultHtml = `<h5 class="font-semibold mb-2">${title} Results</h5>`;

        if (response.success) {
            resultHtml += '<div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-3">';
            resultHtml += '<p class="font-bold">Success!</p>';

            if (response.backup) {
                const backup = response.backup;
                if (backup.filename) {
                    resultHtml += `<p>Backup File: <span class="font-mono text-sm">${backup.filename}</span></p>`;
                }
                if (backup.size) {
                    resultHtml += `<p>Size: <span class="font-semibold">${Math.round(backup.size / 1024)} KB</span></p>`;
                }
                if (backup.timestamp) {
                    resultHtml += `<p>Created: <span class="font-semibold">${new Date(backup.timestamp).toLocaleString()}</span></p>`;
                }
                if (backup.restoredFrom) {
                    resultHtml += `<p>Restored from: <span class="font-mono text-sm">${backup.restoredFrom}</span></p>`;
                }
            }

            if (response.message) {
                resultHtml += `<p>${response.message}</p>`;
            }

            resultHtml += '</div>';
        } else {
            resultHtml += '<div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-3">';
            resultHtml += '<p class="font-bold">Error!</p>';
            resultHtml += `<p>${response.error || 'Unknown error occurred'}</p>`;
            resultHtml += '</div>';
        }

        contentDiv.innerHTML = resultHtml;
        resultsDiv.classList.remove('hidden');

        // Scroll to results
        resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BackupSystemManagement;
} else {
    // For browser usage
    window.BackupSystemManagement = BackupSystemManagement;
}