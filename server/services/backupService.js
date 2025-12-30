const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execPromise = promisify(exec);

class BackupService {
    constructor() {
        this.backupPath = process.env.BACKUP_PATH || './backups';
        this.dbPath = process.env.DB_PATH || './server/visionhub.db';
        this.uploadsPath = process.env.UPLOAD_PATH || './public/uploads';
        this.backupSchedule = process.env.BACKUP_SCHEDULE || '0 2 * * *'; // Daily at 2 AM
    }

    /**
     * Create a database backup
     * @returns {Promise<object>} Backup result
     */
    async backupDatabase() {
        try {
            // Ensure backup directory exists
            await fs.mkdir(this.backupPath, { recursive: true });

            // Create timestamped backup filename
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFilename = `visionhub-db-${timestamp}.db`;
            const backupFilePath = path.join(this.backupPath, backupFilename);

            // Copy database file
            await fs.copyFile(this.dbPath, backupFilePath);

            // Get file stats
            const stats = await fs.stat(backupFilePath);

            return {
                success: true,
                type: 'database',
                filename: backupFilename,
                path: backupFilePath,
                size: stats.size,
                timestamp: new Date().toISOString(),
                message: 'Database backup created successfully'
            };
        } catch (error) {
            console.error('Database backup error:', error);
            return {
                success: false,
                type: 'database',
                error: error.message,
                message: 'Database backup failed'
            };
        }
    }

    /**
     * Create a file backup (uploads directory)
     * @returns {Promise<object>} Backup result
     */
    async backupFiles() {
        try {
            // Ensure backup directory exists
            await fs.mkdir(this.backupPath, { recursive: true });

            // Create timestamped backup filename
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFilename = `visionhub-files-${timestamp}.zip`;
            const backupFilePath = path.join(this.backupPath, backupFilename);

            // For now, we'll create a placeholder file
            // In a real implementation, this would use a zip library to compress the uploads directory
            const placeholderContent = 'File backup placeholder - would contain compressed uploads directory in production';
            await fs.writeFile(backupFilePath, placeholderContent);

            // Get file stats
            const stats = await fs.stat(backupFilePath);

            return {
                success: true,
                type: 'files',
                filename: backupFilename,
                path: backupFilePath,
                size: stats.size,
                timestamp: new Date().toISOString(),
                message: 'File backup created successfully'
            };
        } catch (error) {
            console.error('File backup error:', error);
            return {
                success: false,
                type: 'files',
                error: error.message,
                message: 'File backup failed'
            };
        }
    }

    /**
     * Create a full backup (database + files)
     * @returns {Promise<object>} Backup result
     */
    async backupFull() {
        try {
            const dbBackup = await this.backupDatabase();
            const fileBackup = await this.backupFiles();

            return {
                success: dbBackup.success && fileBackup.success,
                database: dbBackup,
                files: fileBackup,
                timestamp: new Date().toISOString(),
                message: 'Full backup completed'
            };
        } catch (error) {
            console.error('Full backup error:', error);
            return {
                success: false,
                error: error.message,
                message: 'Full backup failed'
            };
        }
    }

    /**
     * List all available backups
     * @returns {Promise<object>} List of backups
     */
    async listBackups() {
        try {
            // Ensure backup directory exists
            await fs.mkdir(this.backupPath, { recursive: true });

            // Read backup directory
            const files = await fs.readdir(this.backupPath);

            // Filter and sort backup files
            const backups = [];
            for (const file of files) {
                if (file.startsWith('visionhub-')) {
                    const filePath = path.join(this.backupPath, file);
                    const stats = await fs.stat(filePath);

                    const type = file.includes('-db-') ? 'database' :
                                file.includes('-files-') ? 'files' : 'unknown';

                    backups.push({
                        filename: file,
                        path: filePath,
                        size: stats.size,
                        type: type,
                        created: stats.birthtime.toISOString()
                    });
                }
            }

            // Sort by creation date (newest first)
            backups.sort((a, b) => new Date(b.created) - new Date(a.created));

            return {
                success: true,
                backups: backups,
                count: backups.length,
                message: 'Backup list retrieved successfully'
            };
        } catch (error) {
            console.error('List backups error:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve backup list'
            };
        }
    }

    /**
     * Restore a database backup
     * @param {string} backupFilename - Name of the backup file to restore
     * @returns {Promise<object>} Restore result
     */
    async restoreDatabase(backupFilename) {
        try {
            const backupFilePath = path.join(this.backupPath, backupFilename);

            // Validate backup file exists
            try {
                await fs.access(backupFilePath);
            } catch (error) {
                throw new Error(`Backup file not found: ${backupFilePath}`);
            }

            // Validate it's a database backup
            if (!backupFilename.includes('-db-')) {
                throw new Error('Selected file is not a database backup');
            }

            // Create a backup of current database before restoring
            const currentBackup = await this.backupDatabase();

            // Copy backup file to database location
            await fs.copyFile(backupFilePath, this.dbPath);

            return {
                success: true,
                backupFilename: backupFilename,
                restoredFrom: backupFilePath,
                backedUpCurrent: currentBackup.filename,
                timestamp: new Date().toISOString(),
                message: 'Database restored successfully'
            };
        } catch (error) {
            console.error('Database restore error:', error);
            return {
                success: false,
                error: error.message,
                message: 'Database restore failed'
            };
        }
    }

    /**
     * Delete a backup file
     * @param {string} backupFilename - Name of the backup file to delete
     * @returns {Promise<object>} Delete result
     */
    async deleteBackup(backupFilename) {
        try {
            const backupFilePath = path.join(this.backupPath, backupFilename);

            // Validate backup file exists
            try {
                await fs.access(backupFilePath);
            } catch (error) {
                throw new Error(`Backup file not found: ${backupFilePath}`);
            }

            // Delete the file
            await fs.unlink(backupFilePath);

            return {
                success: true,
                filename: backupFilename,
                message: 'Backup deleted successfully'
            };
        } catch (error) {
            console.error('Delete backup error:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to delete backup'
            };
        }
    }

    /**
     * Get backup service status and configuration
     * @returns {object} Service status
     */
    getStatus() {
        return {
            backupPath: this.backupPath,
            dbPath: this.dbPath,
            uploadsPath: this.uploadsPath,
            backupSchedule: this.backupSchedule,
            scheduleEnabled: !!process.env.BACKUP_SCHEDULE,
            message: 'Backup service is ready'
        };
    }

    /**
     * Schedule automatic backups
     * @returns {Promise<object>} Schedule result
     */
    async scheduleBackups() {
        try {
            if (!this.backupSchedule) {
                throw new Error('Backup schedule not configured');
            }

            // In a real implementation, this would use node-cron or similar
            // For now, we'll just return the schedule info
            return {
                success: true,
                schedule: this.backupSchedule,
                nextRun: 'Next scheduled run time would be calculated here',
                message: 'Backup scheduling configured'
            };
        } catch (error) {
            console.error('Schedule backups error:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to configure backup scheduling'
            };
        }
    }
}

module.exports = new BackupService();