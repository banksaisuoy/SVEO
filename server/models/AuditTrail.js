class AuditTrail {
    static async create(db, auditData) {
        return await db.run(
            'INSERT INTO audit_trail (user_id, action_type, resource_type, resource_id, old_values, new_values, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [auditData.userId, auditData.action, auditData.resource_type, auditData.resource_id, auditData.old_values, auditData.new_values, auditData.ip_address, auditData.user_agent]
        );
    }

    static async getAll(db, limit = 100) {
        return await db.all(`
            SELECT at.*, u.username as user_name
            FROM audit_trail at
            LEFT JOIN users u ON at.user_id = u.username
            ORDER BY at.created_at DESC
            LIMIT ?
        `, [limit]);
    }

    static async getByUser(db, userId, limit = 50) {
        return await db.all(`
            SELECT at.*
            FROM audit_trail at
            WHERE at.user_id = ?
            ORDER BY at.created_at DESC
            LIMIT ?
        `, [userId, limit]);
    }

    static async getByResource(db, resourceType, resourceId, limit = 50) {
        return await db.all(`
            SELECT at.*, u.username as user_name
            FROM audit_trail at
            LEFT JOIN users u ON at.user_id = u.username
            WHERE at.resource_type = ? AND at.resource_id = ?
            ORDER BY at.created_at DESC
            LIMIT ?
        `, [resourceType, resourceId, limit]);
    }

    static async search(db, filters = {}, limit = 100) {
        let query = `
            SELECT at.*, u.username as user_name
            FROM audit_trail at
            LEFT JOIN users u ON at.user_id = u.username
            WHERE 1=1
        `;
        const params = [];

        if (filters.userId) {
            query += ' AND at.user_id = ?';
            params.push(filters.userId);
        }

        if (filters.action) {
            query += ' AND at.action_type LIKE ?';
            params.push(`%${filters.action}%`);
        }

        if (filters.resource_type) {
            query += ' AND at.resource_type = ?';
            params.push(filters.resource_type);
        }

        if (filters.dateFrom) {
            query += ' AND at.created_at >= ?';
            params.push(filters.dateFrom);
        }

        if (filters.dateTo) {
            query += ' AND at.created_at <= ?';
            params.push(filters.dateTo);
        }

        query += ' ORDER BY at.created_at DESC LIMIT ?';
        params.push(limit);

        return await db.all(query, params);
    }
}

module.exports = AuditTrail;