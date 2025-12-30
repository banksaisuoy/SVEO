class UserGroup {
    static async getAll(db) {
        return await db.all(`
            SELECT ug.*,
                   COUNT(ugm.username) as member_count,
                   u.username as created_by_name
            FROM user_groups ug
            LEFT JOIN user_group_members ugm ON ug.id = ugm.group_id AND ugm.is_active = 1
            LEFT JOIN users u ON ug.created_by = u.username
            WHERE ug.is_active = 1
            GROUP BY ug.id
            ORDER BY ug.name
        `);
    }

    static async getById(db, id) {
        return await db.get('SELECT * FROM user_groups WHERE id = ? AND is_active = 1', [id]);
    }

    static async create(db, groupData) {
        return await db.run(
            'INSERT INTO user_groups (name, description, color, created_by) VALUES (?, ?, ?, ?)',
            [groupData.name, groupData.description, groupData.color, groupData.created_by]
        );
    }

    static async update(db, id, groupData) {
        return await db.run(
            'UPDATE user_groups SET name = ?, description = ?, color = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [groupData.name, groupData.description, groupData.color, id]
        );
    }

    static async delete(db, id) {
        return await db.run('UPDATE user_groups SET is_active = 0 WHERE id = ?', [id]);
    }

    static async getMembers(db, groupId) {
        return await db.all(`
            SELECT ugm.*, u.username, u.fullName, u.email, u.department
            FROM user_group_members ugm
            JOIN users u ON ugm.username = u.username
            WHERE ugm.group_id = ? AND ugm.is_active = 1
            ORDER BY ugm.role_in_group, u.username
        `, [groupId]);
    }

    static async addMember(db, groupId, username, role = 'member', addedBy) {
        return await db.run(
            'INSERT OR REPLACE INTO user_group_members (group_id, username, role_in_group, added_by) VALUES (?, ?, ?, ?)',
            [groupId, username, role, addedBy]
        );
    }

    static async removeMember(db, groupId, username) {
        return await db.run(
            'UPDATE user_group_members SET is_active = 0 WHERE group_id = ? AND username = ?',
            [groupId, username]
        );
    }

    static async getUserGroups(db, username) {
        return await db.all(`
            SELECT ug.*, ugm.role_in_group
            FROM user_groups ug
            JOIN user_group_members ugm ON ug.id = ugm.group_id
            WHERE ugm.username = ? AND ugm.is_active = 1 AND ug.is_active = 1
            ORDER BY ug.name
        `, [username]);
    }
}

module.exports = UserGroup;