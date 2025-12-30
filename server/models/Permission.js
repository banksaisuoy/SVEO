class Permission {
    static async getAll(db) {
        return await db.all('SELECT * FROM permissions ORDER BY category, name');
    }

    static async getByCategory(db, category) {
        return await db.all('SELECT * FROM permissions WHERE category = ? ORDER BY name', [category]);
    }

    static async getUserPermissions(db, username) {
        return await db.all(`
            SELECT DISTINCT p.*
            FROM permissions p
            LEFT JOIN user_permissions up ON p.id = up.permission_id AND up.username = ? AND up.is_active = 1
            LEFT JOIN user_group_members ugm ON ugm.username = ?
            LEFT JOIN group_permissions gp ON p.id = gp.permission_id AND gp.group_id = ugm.group_id AND gp.is_active = 1
            WHERE (up.id IS NOT NULL OR gp.id IS NOT NULL)
            ORDER BY p.category, p.name
        `, [username, username]);
    }

    static async grantUserPermission(db, username, permissionId, grantedBy) {
        return await db.run(
            'INSERT OR REPLACE INTO user_permissions (username, permission_id, granted_by) VALUES (?, ?, ?)',
            [username, permissionId, grantedBy]
        );
    }

    static async revokeUserPermission(db, username, permissionId) {
        return await db.run(
            'UPDATE user_permissions SET is_active = 0 WHERE username = ? AND permission_id = ?',
            [username, permissionId]
        );
    }

    static async grantGroupPermission(db, groupId, permissionId, grantedBy) {
        return await db.run(
            'INSERT OR REPLACE INTO group_permissions (group_id, permission_id, granted_by) VALUES (?, ?, ?)',
            [groupId, permissionId, grantedBy]
        );
    }

    static async revokeGroupPermission(db, groupId, permissionId) {
        return await db.run(
            'UPDATE group_permissions SET is_active = 0 WHERE group_id = ? AND permission_id = ?',
            [groupId, permissionId]
        );
    }
}

module.exports = Permission;