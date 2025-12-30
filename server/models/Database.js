const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

class Database {
    constructor(dbPath = null) {
        this.dbPath = dbPath || path.join(__dirname, '..', 'visionhub.db');
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
            'CREATE INDEX IF NOT EXISTS idx_video_tags_video ON video_tags(video_id)',
            'CREATE INDEX IF NOT EXISTS idx_video_tags_tag ON video_tags(tag_id)',
            'CREATE INDEX IF NOT EXISTS idx_playlist_videos_playlist ON playlist_videos(playlist_id)',
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

module.exports = Database;