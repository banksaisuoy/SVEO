const { Database, AuditTrail } = require('../models/index');

class AuditTrailService {
    constructor() {
        this.db = new Database();
    }

    async initialize() {
        await this.db.connect();
    }

    async logAction(auditData) {
        try {
            await this.initialize();
            const result = await AuditTrail.create(this.db, auditData);
            return { success: true, auditId: result.id };
        } catch (error) {
            console.error('Error logging audit action:', error);
            return { success: false, error: error.message };
        } finally {
            await this.db.close();
        }
    }

    async getAuditTrail(limit = 100) {
        try {
            await this.initialize();
            const auditEntries = await AuditTrail.getAll(this.db, limit);
            return { success: true, auditEntries };
        } catch (error) {
            console.error('Error getting audit trail:', error);
            return { success: false, error: error.message };
        } finally {
            await this.db.close();
        }
    }

    async getAuditByUser(userId, limit = 50) {
        try {
            await this.initialize();
            const auditEntries = await AuditTrail.getByUser(this.db, userId, limit);
            return { success: true, auditEntries };
        } catch (error) {
            console.error('Error getting user audit trail:', error);
            return { success: false, error: error.message };
        } finally {
            await this.db.close();
        }
    }

    async getAuditByResource(resourceType, resourceId, limit = 50) {
        try {
            await this.initialize();
            const auditEntries = await AuditTrail.getByResource(this.db, resourceType, resourceId, limit);
            return { success: true, auditEntries };
        } catch (error) {
            console.error('Error getting resource audit trail:', error);
            return { success: false, error: error.message };
        } finally {
            await this.db.close();
        }
    }

    async searchAuditTrail(filters = {}, limit = 100) {
        try {
            await this.initialize();
            const auditEntries = await AuditTrail.search(this.db, filters, limit);
            return { success: true, auditEntries };
        } catch (error) {
            console.error('Error searching audit trail:', error);
            return { success: false, error: error.message };
        } finally {
            await this.db.close();
        }
    }

    async exportAuditTrail(format = 'json') {
        try {
            await this.initialize();
            const auditEntries = await AuditTrail.getAll(this.db, 1000);

            if (format === 'csv') {
                // Convert to CSV format
                const headers = ['ID', 'User ID', 'Action', 'Resource Type', 'Resource ID', 'Old Values', 'New Values', 'IP Address', 'User Agent', 'Timestamp'];
                const csvRows = [headers.join(',')];

                auditEntries.forEach(entry => {
                    const values = [
                        entry.id,
                        entry.userId,
                        entry.action,
                        entry.resource_type,
                        entry.resource_id,
                        `"${(entry.old_values || '').replace(/"/g, '""')}"`,
                        `"${(entry.new_values || '').replace(/"/g, '""')}"`,
                        entry.ip_address,
                        `"${(entry.user_agent || '').replace(/"/g, '""')}"`,
                        entry.created_at
                    ];
                    csvRows.push(values.join(','));
                });

                return { success: true, data: csvRows.join('\n') };
            } else {
                // Default to JSON
                return { success: true, data: JSON.stringify(auditEntries, null, 2) };
            }
        } catch (error) {
            console.error('Error exporting audit trail:', error);
            return { success: false, error: error.message };
        } finally {
            await this.db.close();
        }
    }

    async clearAuditTrail() {
        try {
            await this.initialize();
            await this.db.run('DELETE FROM audit_trail');
            return { success: true, message: 'Audit trail cleared successfully' };
        } catch (error) {
            console.error('Error clearing audit trail:', error);
            return { success: false, error: error.message };
        } finally {
            await this.db.close();
        }
    }
}

module.exports = AuditTrailService;