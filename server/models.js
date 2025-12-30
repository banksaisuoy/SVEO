const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

class Database {
    constructor(dbPath = null) {
        this.dbPath = dbPath || path.join(__dirname, 'visionhub.db');
        this.db = null;
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('Error opening database:', err.message);
                    reject(err);
                } else {
                    console.log('Connected to SQLite database.');
                    // Enable foreign keys and performance optimizations
                    this.db.run('PRAGMA foreign_keys = ON');
                    this.db.run('PRAGMA journal_mode = WAL');
                    this.db.run('PRAGMA synchronous = NORMAL');
                    this.db.run('PRAGMA cache_size = 10000');
                    this.db.run('PRAGMA temp_store = MEMORY');
                    resolve(this.db);
                }
            });
        });
    }

    close() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        reject(err);
                    } else {
                        console.log('Database connection closed.');
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    }

    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });
        });
    }

    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, result) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
    }

    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Database optimization methods
    async createIndexes() {
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_videos_category ON videos(categoryId)',
            'CREATE INDEX IF NOT EXISTS idx_videos_featured ON videos(isFeatured)',
            'CREATE INDEX IF NOT EXISTS idx_videos_views ON videos(views)',
            'CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at)',
            'CREATE INDEX IF NOT EXISTS idx_user_favorites_user ON user_favorites(userId)',
            'CREATE INDEX IF NOT EXISTS idx_user_favorites_video ON user_favorites(videoId)',
            'CREATE INDEX IF NOT EXISTS idx_comments_video ON comments(videoId)',
            'CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(userId)',
            'CREATE INDEX IF NOT EXISTS idx_logs_user ON logs(userId)',
            'CREATE INDEX IF NOT EXISTS idx_logs_action ON logs(action)',
            'CREATE INDEX IF NOT EXISTS idx_reports_video ON reports(videoId)',
            'CREATE INDEX IF NOT EXISTS idx_video_tags_video ON video_tags(videoId)',
            'CREATE INDEX IF NOT EXISTS idx_video_tags_tag ON video_tags(tagId)',
            'CREATE INDEX IF NOT EXISTS idx_playlist_videos_playlist ON playlist_videos(playlistId)',
            'CREATE INDEX IF NOT EXISTS idx_user_group_members_user ON user_group_members(username)',
            'CREATE INDEX IF NOT EXISTS idx_user_group_members_group ON user_group_members(group_id)',
            'CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(username)',
            'CREATE INDEX IF NOT EXISTS idx_group_permissions_group ON group_permissions(group_id)'
        ];

        for (const indexSql of indexes) {
            try {
                await this.run(indexSql);
            } catch (error) {
                console.error('Error creating index:', error.message);
            }
        }
        console.log('Database indexes created successfully');
    }

    async analyze() {
        try {
            await this.run('ANALYZE');
            console.log('Database analyzed successfully');
        } catch (error) {
            console.error('Error analyzing database:', error.message);
        }
    }

    async vacuum() {
        try {
            await this.run('VACUUM');
            console.log('Database vacuumed successfully');
        } catch (error) {
            console.error('Error vacuuming database:', error.message);
        }
    }

    async getStatistics() {
        try {
            const stats = {};

            // Get table row counts
            const tables = ['users', 'videos', 'categories', 'comments', 'user_favorites', 'logs'];
            for (const table of tables) {
                const result = await this.get(`SELECT COUNT(*) as count FROM ${table}`);
                stats[`${table}_count`] = result.count;
            }

            // Get database size
            const sizeResult = await this.get('PRAGMA page_count');
            const pageSizeResult = await this.get('PRAGMA page_size');
            stats.database_size_mb = Math.round((sizeResult.page_count * pageSizeResult.page_size) / 1024 / 1024 * 100) / 100;

            // Get index usage
            const indexStats = await this.all('PRAGMA index_list(videos)');
            stats.indexes_count = indexStats.length;

            return stats;
        } catch (error) {
            console.error('Error getting database statistics:', error.message);
            return {};
        }
    }
}

// Models
class User {
    static async findByUsername(db, username) {
        return await db.get('SELECT * FROM users WHERE username = ?', [username]);
    }

    static async create(db, userData) {
        const hashedPassword = await bcrypt.hash(userData.password, 10);
        return await db.run(
            'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
            [userData.username, hashedPassword, userData.role || 'user']
        );
    }

    static async update(db, username, userData) {
        const updates = [];
        const values = [];

        if (userData.password) {
            updates.push('password = ?');
            values.push(await bcrypt.hash(userData.password, 10));
        }
        if (userData.role) {
            updates.push('role = ?');
            values.push(userData.role);
        }
        if (userData.fullName !== undefined) {
            updates.push('fullName = ?');
            values.push(userData.fullName);
        }
        if (userData.department !== undefined) {
            updates.push('department = ?');
            values.push(userData.department);
        }
        if (userData.employeeId !== undefined) {
            updates.push('employeeId = ?');
            values.push(userData.employeeId);
        }
        if (userData.email !== undefined) {
            updates.push('email = ?');
            values.push(userData.email);
        }
        if (userData.phone !== undefined) {
            updates.push('phone = ?');
            values.push(userData.phone);
        }

        values.push(username);

        return await db.run(
            `UPDATE users SET ${updates.join(', ')} WHERE username = ?`,
            values
        );
    }

    static async getAll(db) {
        return await db.all('SELECT username, role, created_at FROM users ORDER BY created_at DESC');
    }

    static async validatePassword(plainPassword, hashedPassword) {
        return await bcrypt.compare(plainPassword, hashedPassword);
    }
}

class Video {
    static async getAll(db) {
        return await db.all(`
            SELECT v.*, c.name as categoryName
            FROM videos v
            LEFT JOIN categories c ON v.categoryId = c.id
            ORDER BY v.created_at DESC
        `);
    }

    static async getById(db, id) {
        return await db.get(`
            SELECT v.*, c.name as categoryName
            FROM videos v
            LEFT JOIN categories c ON v.categoryId = c.id
            WHERE v.id = ?
        `, [id]);
    }

    static async getFeatured(db) {
        return await db.all(`
            SELECT v.*, c.name as categoryName
            FROM videos v
            LEFT JOIN categories c ON v.categoryId = c.id
            WHERE v.isFeatured = 1
            ORDER BY v.created_at DESC
        `);
    }

    static async getTrending(db, limit = 4) {
        return await db.all(`
            SELECT v.*, c.name as categoryName
            FROM videos v
            LEFT JOIN categories c ON v.categoryId = c.id
            ORDER BY v.views DESC
            LIMIT ?
        `, [limit]);
    }

    static async search(db, query) {
        const searchTerm = `%${query}%`;
        return await db.all(`
            SELECT v.*, c.name as categoryName
            FROM videos v
            LEFT JOIN categories c ON v.categoryId = c.id
            WHERE v.title LIKE ? OR v.description LIKE ? OR c.name LIKE ?
            ORDER BY v.created_at DESC
        `, [searchTerm, searchTerm, searchTerm]);
    }

    static async create(db, videoData) {
        return await db.run(`
            INSERT INTO videos (title, description, thumbnailUrl, videoUrl, categoryId, isFeatured)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [
            videoData.title,
            videoData.description,
            videoData.thumbnailUrl,
            videoData.videoUrl,
            videoData.categoryId,
            videoData.isFeatured ? 1 : 0
        ]);
    }

    static async update(db, id, videoData) {
        return await db.run(`
            UPDATE videos
            SET title = ?, description = ?, thumbnailUrl = ?, videoUrl = ?, categoryId = ?, isFeatured = ?
            WHERE id = ?
        `, [
            videoData.title,
            videoData.description,
            videoData.thumbnailUrl,
            videoData.videoUrl,
            videoData.categoryId,
            videoData.isFeatured ? 1 : 0,
            id
        ]);
    }

    static async delete(db, id) {
        return await db.run('DELETE FROM videos WHERE id = ?', [id]);
    }

    static async incrementViews(db, id) {
        return await db.run('UPDATE videos SET views = views + 1 WHERE id = ?', [id]);
    }
}

class Category {
    static async getAll(db) {
        return await db.all('SELECT * FROM categories ORDER BY name');
    }

    static async getById(db, id) {
        return await db.get('SELECT * FROM categories WHERE id = ?', [id]);
    }

    static async create(db, name) {
        return await db.run('INSERT INTO categories (name) VALUES (?)', [name]);
    }

    static async update(db, id, name) {
        return await db.run('UPDATE categories SET name = ? WHERE id = ?', [name, id]);
    }

    static async delete(db, id) {
        return await db.run('DELETE FROM categories WHERE id = ?', [id]);
    }
}

class Favorite {
    static async getUserFavorites(db, userId) {
        return await db.all(`
            SELECT v.*, c.name as categoryName
            FROM videos v
            LEFT JOIN categories c ON v.categoryId = c.id
            INNER JOIN user_favorites uf ON v.id = uf.videoId
            WHERE uf.userId = ?
            ORDER BY uf.created_at DESC
        `, [userId]);
    }

    static async isFavorited(db, userId, videoId) {
        const result = await db.get(
            'SELECT COUNT(*) as count FROM user_favorites WHERE userId = ? AND videoId = ?',
            [userId, videoId]
        );
        return result.count > 0;
    }

    static async add(db, userId, videoId) {
        return await db.run(
            'INSERT OR IGNORE INTO user_favorites (userId, videoId) VALUES (?, ?)',
            [userId, videoId]
        );
    }

    static async remove(db, userId, videoId) {
        return await db.run(
            'DELETE FROM user_favorites WHERE userId = ? AND videoId = ?',
            [userId, videoId]
        );
    }
}

class Comment {
    static async getByVideoId(db, videoId) {
        return await db.all(`
            SELECT * FROM comments
            WHERE videoId = ?
            ORDER BY created_at DESC
        `, [videoId]);
    }

    static async create(db, commentData) {
        return await db.run(
            'INSERT INTO comments (videoId, userId, text) VALUES (?, ?, ?)',
            [commentData.videoId, commentData.userId, commentData.text]
        );
    }

    static async delete(db, id) {
        return await db.run('DELETE FROM comments WHERE id = ?', [id]);
    }
}

class Report {
    static async getAll(db) {
        return await db.all(`
            SELECT r.*, v.title as videoTitle
            FROM reports r
            LEFT JOIN videos v ON r.videoId = v.id
            ORDER BY r.created_at DESC
        `);
    }

    static async create(db, reportData) {
        return await db.run(
            'INSERT INTO reports (userId, videoId, reason) VALUES (?, ?, ?)',
            [reportData.userId, reportData.videoId, reportData.reason]
        );
    }

    static async delete(db, id) {
        return await db.run('DELETE FROM reports WHERE id = ?', [id]);
    }
}

class Log {
    static async getRecent(db, limit = 100) {
        return await db.all(
            'SELECT * FROM logs ORDER BY created_at DESC LIMIT ?',
            [limit]
        );
    }

    static async create(db, userId, action, details = '') {
        return await db.run(
            'INSERT INTO logs (userId, action, details) VALUES (?, ?, ?)',
            [userId, action, details]
        );
    }
}

class Settings {
    static async getAll(db) {
        return await db.all('SELECT * FROM settings');
    }

    static async get(db, key) {
        return await db.get('SELECT value FROM settings WHERE key = ?', [key]);
    }

    static async set(db, key, value) {
        return await db.run(
            'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
            [key, value]
        );
    }
}

class ReportReason {
    static async getAll(db) {
        return await db.all('SELECT * FROM report_reasons WHERE is_active = 1 ORDER BY reason');
    }

    static async getById(db, id) {
        return await db.get('SELECT * FROM report_reasons WHERE id = ?', [id]);
    }

    static async create(db, reason) {
        return await db.run('INSERT INTO report_reasons (reason) VALUES (?)', [reason]);
    }

    static async update(db, id, reason) {
        return await db.run('UPDATE report_reasons SET reason = ? WHERE id = ?', [reason, id]);
    }

    static async delete(db, id) {
        return await db.run('UPDATE report_reasons SET is_active = 0 WHERE id = ?', [id]);
    }

    static async restore(db, id) {
        return await db.run('UPDATE report_reasons SET is_active = 1 WHERE id = ?', [id]);
    }
}

// User Groups Management
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

// Permissions Management
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

// Password Policy Management
class PasswordPolicy {
    static async getActive(db) {
        return await db.get('SELECT * FROM password_policies WHERE is_active = 1 ORDER BY created_at DESC LIMIT 1');
    }

    static async getAll(db) {
        return await db.all('SELECT * FROM password_policies ORDER BY created_at DESC');
    }

    static async create(db, policyData) {
        // Deactivate current active policy
        await db.run('UPDATE password_policies SET is_active = 0 WHERE is_active = 1');

        return await db.run(`
            INSERT INTO password_policies
            (name, min_length, require_uppercase, require_lowercase, require_numbers,
             require_special_chars, max_age_days, history_count, lockout_attempts,
             lockout_duration_minutes, is_active, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
        `, [
            policyData.name,
            policyData.min_length,
            policyData.require_uppercase,
            policyData.require_lowercase,
            policyData.require_numbers,
            policyData.require_special_chars,
            policyData.max_age_days,
            policyData.history_count,
            policyData.lockout_attempts,
            policyData.lockout_duration_minutes,
            policyData.created_by
        ]);
    }

    static async validatePassword(password, policy = null) {
        if (!policy) {
            return { valid: true, errors: [] };
        }

        const errors = [];

        if (password.length < policy.min_length) {
            errors.push(`Password must be at least ${policy.min_length} characters long`);
        }

        if (policy.require_uppercase && !/[A-Z]/.test(password)) {
            errors.push('Password must contain at least one uppercase letter');
        }

        if (policy.require_lowercase && !/[a-z]/.test(password)) {
            errors.push('Password must contain at least one lowercase letter');
        }

        if (policy.require_numbers && !/\d/.test(password)) {
            errors.push('Password must contain at least one number');
        }

        if (policy.require_special_chars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
            errors.push('Password must contain at least one special character');
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }
}

// Tag Management
class Tag {
    static async getAll(db) {
        return await db.all('SELECT * FROM tags ORDER BY name');
    }

    static async getById(db, id) {
        return await db.get('SELECT * FROM tags WHERE id = ?', [id]);
    }

    static async create(db, tagData) {
        return await db.run(
            'INSERT INTO tags (name, description, color) VALUES (?, ?, ?)',
            [tagData.name, tagData.description || '', tagData.color || '#2563eb']
        );
    }

    static async update(db, id, tagData) {
        return await db.run(
            'UPDATE tags SET name = ?, description = ?, color = ? WHERE id = ?',
            [tagData.name, tagData.description || '', tagData.color || '#2563eb', id]
        );
    }

    static async delete(db, id) {
        // Remove tag from all videos first
        await db.run('DELETE FROM video_tags WHERE tagId = ?', [id]);
        // Delete the tag
        return await db.run('DELETE FROM tags WHERE id = ?', [id]);
    }

    static async getVideoTags(db, videoId) {
        return await db.all(`
            SELECT t.* FROM tags t
            INNER JOIN video_tags vt ON t.id = vt.tagId
            WHERE vt.videoId = ?
            ORDER BY t.name
        `, [videoId]);
    }

    static async addToVideo(db, videoId, tagId) {
        return await db.run(
            'INSERT OR IGNORE INTO video_tags (videoId, tagId) VALUES (?, ?)',
            [videoId, tagId]
        );
    }

    static async removeFromVideo(db, videoId, tagId) {
        return await db.run(
            'DELETE FROM video_tags WHERE videoId = ? AND tagId = ?',
            [videoId, tagId]
        );
    }

    static async searchVideos(db, tagNames) {
        const placeholders = tagNames.map(() => '?').join(',');
        return await db.all(`
            SELECT DISTINCT v.*, c.name as categoryName,
                   GROUP_CONCAT(t.name) as tagNames
            FROM videos v
            LEFT JOIN categories c ON v.categoryId = c.id
            INNER JOIN video_tags vt ON v.id = vt.videoId
            INNER JOIN tags t ON vt.tagId = t.id
            WHERE t.name IN (${placeholders}) OR t.id IN (${placeholders})
            GROUP BY v.id
            ORDER BY v.created_at DESC
        `, [...tagNames, ...tagNames]);
    }
}

// Playlist Management
class Playlist {
    static async getUserPlaylists(db, userId) {
        return await db.all(`
            SELECT p.*, COUNT(pv.videoId) as video_count
            FROM playlists p
            LEFT JOIN playlist_videos pv ON p.id = pv.playlistId
            WHERE p.userId = ? AND p.is_active = 1
            GROUP BY p.id
            ORDER BY p.updated_at DESC
        `, [userId]);
    }

    static async getById(db, id) {
        return await db.get('SELECT * FROM playlists WHERE id = ? AND is_active = 1', [id]);
    }

    static async create(db, playlistData) {
        return await db.run(
            'INSERT INTO playlists (name, description, userId, is_public) VALUES (?, ?, ?, ?)',
            [playlistData.name, playlistData.description || '', playlistData.userId, playlistData.is_public ? 1 : 0]
        );
    }

    static async update(db, id, playlistData) {
        return await db.run(
            'UPDATE playlists SET name = ?, description = ?, is_public = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [playlistData.name, playlistData.description || '', playlistData.is_public ? 1 : 0, id]
        );
    }

    static async delete(db, id) {
        return await db.run('UPDATE playlists SET is_active = 0 WHERE id = ?', [id]);
    }

    static async getVideos(db, playlistId) {
        return await db.all(`
            SELECT v.*, c.name as categoryName, pv.position, pv.added_at
            FROM videos v
            LEFT JOIN categories c ON v.categoryId = c.id
            INNER JOIN playlist_videos pv ON v.id = pv.videoId
            WHERE pv.playlistId = ?
            ORDER BY pv.position, pv.added_at
        `, [playlistId]);
    }

    static async addVideo(db, playlistId, videoId, position = null) {
        if (position === null) {
            const result = await db.get(
                'SELECT COALESCE(MAX(position), 0) + 1 as nextPosition FROM playlist_videos WHERE playlistId = ?',
                [playlistId]
            );
            position = result.nextPosition;
        }

        return await db.run(
            'INSERT OR REPLACE INTO playlist_videos (playlistId, videoId, position) VALUES (?, ?, ?)',
            [playlistId, videoId, position]
        );
    }

    static async removeVideo(db, playlistId, videoId) {
        return await db.run(
            'DELETE FROM playlist_videos WHERE playlistId = ? AND videoId = ?',
            [playlistId, videoId]
        );
    }

    static async reorderVideos(db, playlistId, videoOrders) {
        const promises = videoOrders.map(({ videoId, position }) =>
            db.run(
                'UPDATE playlist_videos SET position = ? WHERE playlistId = ? AND videoId = ?',
                [position, playlistId, videoId]
            )
        );
        return Promise.all(promises);
    }
}

// Content Scheduling
class ContentSchedule {
    static async getAll(db) {
        return await db.all(`
            SELECT cs.*, v.title as videoTitle, u.username as scheduled_by_name
            FROM content_schedule cs
            LEFT JOIN videos v ON cs.videoId = v.id
            LEFT JOIN users u ON cs.scheduled_by = u.username
            ORDER BY cs.publish_at ASC
        `);
    }

    static async getPending(db) {
        return await db.all(`
            SELECT cs.*, v.title as videoTitle
            FROM content_schedule cs
            LEFT JOIN videos v ON cs.videoId = v.id
            WHERE cs.status = 'pending' AND cs.publish_at <= CURRENT_TIMESTAMP
            ORDER BY cs.publish_at ASC
        `);
    }

    static async create(db, scheduleData) {
        return await db.run(
            'INSERT INTO content_schedule (videoId, publish_at, action_type, scheduled_by, description) VALUES (?, ?, ?, ?, ?)',
            [scheduleData.videoId, scheduleData.publish_at, scheduleData.action_type || 'publish', scheduleData.scheduled_by, scheduleData.description || '']
        );
    }

    static async update(db, id, scheduleData) {
        return await db.run(
            'UPDATE content_schedule SET publish_at = ?, action_type = ?, description = ?, status = ? WHERE id = ?',
            [scheduleData.publish_at, scheduleData.action_type, scheduleData.description, scheduleData.status, id]
        );
    }

    static async execute(db, id) {
        return await db.run(
            'UPDATE content_schedule SET status = "executed", executed_at = CURRENT_TIMESTAMP WHERE id = ?',
            [id]
        );
    }

    static async cancel(db, id) {
        return await db.run(
            'UPDATE content_schedule SET status = "cancelled" WHERE id = ?',
            [id]
        );
    }
}

// Audit Trail
class AuditTrail {
    static async create(db, auditData) {
        return await db.run(
            'INSERT INTO audit_trail (userId, action, resource_type, resource_id, old_values, new_values, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [auditData.userId, auditData.action, auditData.resource_type, auditData.resource_id, auditData.old_values, auditData.new_values, auditData.ip_address, auditData.user_agent]
        );
    }

    static async getAll(db, limit = 100) {
        return await db.all(`
            SELECT at.*, u.username as user_name
            FROM audit_trail at
            LEFT JOIN users u ON at.userId = u.username
            ORDER BY at.created_at DESC
            LIMIT ?
        `, [limit]);
    }

    static async getByUser(db, userId, limit = 50) {
        return await db.all(`
            SELECT at.*
            FROM audit_trail at
            WHERE at.userId = ?
            ORDER BY at.created_at DESC
            LIMIT ?
        `, [userId, limit]);
    }

    static async getByResource(db, resourceType, resourceId, limit = 50) {
        return await db.all(`
            SELECT at.*, u.username as user_name
            FROM audit_trail at
            LEFT JOIN users u ON at.userId = u.username
            WHERE at.resource_type = ? AND at.resource_id = ?
            ORDER BY at.created_at DESC
            LIMIT ?
        `, [resourceType, resourceId, limit]);
    }

    static async search(db, filters = {}, limit = 100) {
        let query = `
            SELECT at.*, u.username as user_name
            FROM audit_trail at
            LEFT JOIN users u ON at.userId = u.username
            WHERE 1=1
        `;
        const params = [];

        if (filters.userId) {
            query += ' AND at.userId = ?';
            params.push(filters.userId);
        }

        if (filters.action) {
            query += ' AND at.action LIKE ?';
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

module.exports = {
    Database,
    User,
    Video,
    Category,
    Favorite,
    Comment,
    Report,
    Log,
    Settings,
    ReportReason,
    UserGroup,
    Permission,
    PasswordPolicy,
    Tag,
    Playlist,
    ContentSchedule,
    AuditTrail
};