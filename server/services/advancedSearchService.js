const { Database, Video, Category, Tag } = require('../models/index');

class AdvancedSearchService {
    constructor() {
        this.db = new Database();
    }

    async initialize() {
        await this.db.connect();
    }

    async searchVideos(query, filters = {}) {
        try {
            await this.initialize();

            // Build the search query dynamically
            let sql = `
                SELECT v.*, c.name as categoryName
                FROM videos v
                LEFT JOIN categories c ON v.categoryId = c.id
            `;

            const params = [];
            const whereConditions = [];

            // Add search term conditions
            if (query) {
                whereConditions.push(`
                    (v.title LIKE ? OR v.description LIKE ?)
                `);
                params.push(`%${query}%`, `%${query}%`);
            }

            // Add category filter
            if (filters.categoryId) {
                whereConditions.push('v.categoryId = ?');
                params.push(filters.categoryId);
            }

            // Add date range filters
            if (filters.dateFrom) {
                whereConditions.push('v.created_at >= ?');
                params.push(filters.dateFrom);
            }

            if (filters.dateTo) {
                whereConditions.push('v.created_at <= ?');
                params.push(filters.dateTo);
            }

            // Add featured filter
            if (filters.isFeatured !== undefined) {
                whereConditions.push('v.isFeatured = ?');
                params.push(filters.isFeatured ? 1 : 0);
            }

            // Add views filter
            if (filters.minViews !== undefined) {
                whereConditions.push('v.views >= ?');
                params.push(filters.minViews);
            }

            if (filters.maxViews !== undefined) {
                whereConditions.push('v.views <= ?');
                params.push(filters.maxViews);
            }

            // Combine where conditions
            if (whereConditions.length > 0) {
                sql += ' WHERE ' + whereConditions.join(' AND ');
            }

            // Add ordering
            sql += ' ORDER BY v.created_at DESC';

            // Add limit
            if (filters.limit) {
                sql += ' LIMIT ?';
                params.push(filters.limit);
            }

            const videos = await this.db.all(sql, params);
            return { success: true, videos };
        } catch (error) {
            console.error('Error searching videos:', error);
            return { success: false, error: error.message };
        } finally {
            await this.db.close();
        }
    }

    async searchVideosByTags(tagNames) {
        try {
            await this.initialize();

            if (!Array.isArray(tagNames) || tagNames.length === 0) {
                return { success: true, videos: [] };
            }

            const videos = await Tag.searchVideos(this.db, tagNames);
            return { success: true, videos };
        } catch (error) {
            console.error('Error searching videos by tags:', error);
            return { success: false, error: error.message };
        } finally {
            await this.db.close();
        }
    }

    async getSearchConfig() {
        try {
            await this.initialize();

            // Get settings from database
            const settings = await this.db.all('SELECT key, value FROM settings WHERE key LIKE "search_%"');

            // Convert settings to config object
            const config = {
                enabled: true,
                minSearchLength: 2,
                maxResults: 50,
                searchFields: {
                    title: true,
                    description: true,
                    tags: true,
                    category: true
                },
                disabledCategories: []
            };

            // Apply settings from database
            settings.forEach(setting => {
                const key = setting.key.replace('search_', '');
                if (key === 'min_search_length') {
                    config.minSearchLength = parseInt(setting.value) || 2;
                } else if (key === 'max_results') {
                    config.maxResults = parseInt(setting.value) || 50;
                } else if (key === 'disabled_categories') {
                    config.disabledCategories = setting.value ? setting.value.split(',').map(id => parseInt(id)) : [];
                }
            });

            return { success: true, config };
        } catch (error) {
            console.error('Error getting search config:', error);
            return { success: false, error: error.message };
        } finally {
            await this.db.close();
        }
    }

    async saveSearchConfig(config) {
        try {
            await this.initialize();

            // Save settings to database
            const settings = [
                ['search_min_search_length', config.minSearchLength || 2],
                ['search_max_results', config.maxResults || 50],
                ['search_disabled_categories', config.disabledCategories ? config.disabledCategories.join(',') : '']
            ];

            for (const [key, value] of settings) {
                await this.db.run(
                    'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
                    [key, value.toString()]
                );
            }

            return { success: true, message: 'Search configuration saved successfully' };
        } catch (error) {
            console.error('Error saving search config:', error);
            return { success: false, error: error.message };
        } finally {
            await this.db.close();
        }
    }

    async getSearchSuggestions(query, limit = 10) {
        try {
            await this.initialize();

            if (!query || query.length < 2) {
                return { success: true, suggestions: [] };
            }

            const searchTerm = `%${query}%`;

            // Get video title suggestions
            const videoSuggestions = await this.db.all(`
                SELECT DISTINCT title
                FROM videos
                WHERE title LIKE ?
                ORDER BY views DESC
                LIMIT ?
            `, [searchTerm, Math.ceil(limit / 2)]);

            // Get category suggestions
            const categorySuggestions = await this.db.all(`
                SELECT DISTINCT name
                FROM categories
                WHERE name LIKE ?
                LIMIT ?
            `, [searchTerm, Math.floor(limit / 2)]);

            // Combine and deduplicate suggestions
            const suggestions = [
                ...videoSuggestions.map(s => s.title),
                ...categorySuggestions.map(s => s.name)
            ];

            // Remove duplicates and limit
            const uniqueSuggestions = [...new Set(suggestions)].slice(0, limit);

            return { success: true, suggestions: uniqueSuggestions };
        } catch (error) {
            console.error('Error getting search suggestions:', error);
            return { success: false, error: error.message };
        } finally {
            await this.db.close();
        }
    }
}

module.exports = AdvancedSearchService;