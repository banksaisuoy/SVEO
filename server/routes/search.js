const express = require('express');
const { Database, Video, Tag } = require('../models/index');
const router = express.Router();

let database;

// Initialize database connection
async function initDatabase() {
    if (!database) {
        database = new Database();
        await database.connect();
    }
    return database;
}

// Advanced search endpoint
router.get('/', async (req, res) => {
    try {
        const db = await initDatabase();
        const {
            q,           // General search query
            category,    // Category filter
            tags,        // Comma-separated tag names/IDs
            duration_min,  // Minimum duration in seconds
            duration_max,  // Maximum duration in seconds
            views_min,   // Minimum views
            views_max,   // Maximum views
            featured,    // Filter featured videos (true/false)
            sort_by,     // Sort field: created_at, views, title
            sort_order,  // Sort order: asc, desc
            limit,       // Result limit
            offset       // Result offset for pagination
        } = req.query;

        let query = `
            SELECT DISTINCT v.*, c.name as categoryName,
                   GROUP_CONCAT(DISTINCT t.name) as tagNames
            FROM videos v
            LEFT JOIN categories c ON v.categoryId = c.id
            LEFT JOIN video_tags vt ON v.id = vt.videoId
            LEFT JOIN tags t ON vt.tagId = t.id
            WHERE 1=1
        `;

        const params = [];
        const conditions = [];

        // General text search
        if (q && q.trim()) {
            conditions.push(`(
                v.title LIKE ? OR
                v.description LIKE ? OR
                c.name LIKE ? OR
                t.name LIKE ?
            )`);
            const searchTerm = `%${q.trim()}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        // Category filter
        if (category) {
            if (isNaN(category)) {
                // Search by category name
                conditions.push('c.name = ?');
                params.push(category);
            } else {
                // Search by category ID
                conditions.push('v.categoryId = ?');
                params.push(parseInt(category));
            }
        }

        // Tags filter
        if (tags && tags.trim()) {
            const tagList = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
            if (tagList.length > 0) {
                const tagPlaceholders = tagList.map(() => '?').join(',');
                conditions.push(`(
                    t.name IN (${tagPlaceholders}) OR
                    t.id IN (${tagPlaceholders})
                )`);
                params.push(...tagList, ...tagList);
            }
        }

        // Duration filters
        if (duration_min && !isNaN(duration_min)) {
            conditions.push('v.duration >= ?');
            params.push(parseInt(duration_min));
        }

        if (duration_max && !isNaN(duration_max)) {
            conditions.push('v.duration <= ?');
            params.push(parseInt(duration_max));
        }

        // Views filters
        if (views_min && !isNaN(views_min)) {
            conditions.push('v.views >= ?');
            params.push(parseInt(views_min));
        }

        if (views_max && !isNaN(views_max)) {
            conditions.push('v.views <= ?');
            params.push(parseInt(views_max));
        }

        // Featured filter
        if (featured !== undefined) {
            const isFeatured = featured === 'true' ? 1 : 0;
            conditions.push('v.isFeatured = ?');
            params.push(isFeatured);
        }

        // Add conditions to query
        if (conditions.length > 0) {
            query += ' AND ' + conditions.join(' AND ');
        }

        // Group by video ID to avoid duplicates from JOINs
        query += ' GROUP BY v.id';

        // Sorting
        const validSortFields = ['created_at', 'views', 'title', 'duration'];
        const validSortOrders = ['asc', 'desc'];

        const sortField = validSortFields.includes(sort_by) ? sort_by : 'created_at';
        const sortOrder = validSortOrders.includes(sort_order?.toLowerCase()) ? sort_order.toLowerCase() : 'desc';

        query += ` ORDER BY v.${sortField} ${sortOrder.toUpperCase()}`;

        // Pagination
        const limitValue = parseInt(limit) || 20;
        const offsetValue = parseInt(offset) || 0;

        query += ' LIMIT ? OFFSET ?';
        params.push(limitValue, offsetValue);

        const videos = await db.all(query, params);

        // Get total count for pagination
        let countQuery = `
            SELECT COUNT(DISTINCT v.id) as total
            FROM videos v
            LEFT JOIN categories c ON v.categoryId = c.id
            LEFT JOIN video_tags vt ON v.id = vt.videoId
            LEFT JOIN tags t ON vt.tagId = t.id
            WHERE 1=1
        `;

        if (conditions.length > 0) {
            countQuery += ' AND ' + conditions.join(' AND ');
        }

        const countParams = params.slice(0, -2); // Remove limit and offset params
        const countResult = await db.get(countQuery, countParams);
        const total = countResult.total;

        res.json({
            success: true,
            videos,
            pagination: {
                total,
                limit: limitValue,
                offset: offsetValue,
                hasMore: offsetValue + limitValue < total
            },
            filters: {
                q,
                category,
                tags,
                duration_min,
                duration_max,
                views_min,
                views_max,
                featured,
                sort_by: sortField,
                sort_order: sortOrder
            }
        });
    } catch (error) {
        console.error('Advanced search error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Search suggestions endpoint
router.get('/suggestions', async (req, res) => {
    try {
        const db = await initDatabase();
        const { q } = req.query;

        if (!q || q.trim().length < 2) {
            return res.json({ success: true, suggestions: [] });
        }

        const searchTerm = `%${q.trim()}%`;

        // Get video title suggestions
        const videoSuggestions = await db.all(`
            SELECT DISTINCT title as suggestion, 'video' as type
            FROM videos
            WHERE title LIKE ?
            ORDER BY views DESC
            LIMIT 5
        `, [searchTerm]);

        // Get category suggestions
        const categorySuggestions = await db.all(`
            SELECT DISTINCT name as suggestion, 'category' as type
            FROM categories
            WHERE name LIKE ?
            ORDER BY name
            LIMIT 3
        `, [searchTerm]);

        // Get tag suggestions
        const tagSuggestions = await db.all(`
            SELECT DISTINCT name as suggestion, 'tag' as type
            FROM tags
            WHERE name LIKE ?
            ORDER BY name
            LIMIT 5
        `, [searchTerm]);

        const suggestions = [
            ...videoSuggestions,
            ...categorySuggestions,
            ...tagSuggestions
        ];

        res.json({ success: true, suggestions });
    } catch (error) {
        console.error('Search suggestions error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get search filters (available categories, tags, etc.)
router.get('/filters', async (req, res) => {
    try {
        const db = await initDatabase();

        // Get all categories
        const categories = await db.all(`
            SELECT c.*, COUNT(v.id) as video_count
            FROM categories c
            LEFT JOIN videos v ON c.id = v.categoryId
            GROUP BY c.id
            ORDER BY c.name
        `);

        // Get all tags with usage count
        const tags = await db.all(`
            SELECT t.*, COUNT(vt.videoId) as usage_count
            FROM tags t
            LEFT JOIN video_tags vt ON t.id = vt.tagId
            GROUP BY t.id
            ORDER BY usage_count DESC, t.name
        `);

        // Get duration ranges
        const durationStats = await db.get(`
            SELECT
                MIN(duration) as min_duration,
                MAX(duration) as max_duration,
                AVG(duration) as avg_duration
            FROM videos
            WHERE duration IS NOT NULL AND duration > 0
        `);

        // Get views ranges
        const viewsStats = await db.get(`
            SELECT
                MIN(views) as min_views,
                MAX(views) as max_views,
                AVG(views) as avg_views
            FROM videos
        `);

        res.json({
            success: true,
            filters: {
                categories,
                tags,
                duration: {
                    min: durationStats?.min_duration || 0,
                    max: durationStats?.max_duration || 0,
                    avg: Math.round(durationStats?.avg_duration || 0)
                },
                views: {
                    min: viewsStats?.min_views || 0,
                    max: viewsStats?.max_views || 0,
                    avg: Math.round(viewsStats?.avg_views || 0)
                },
                sortOptions: [
                    { value: 'created_at', label: 'Upload Date' },
                    { value: 'views', label: 'View Count' },
                    { value: 'title', label: 'Title' },
                    { value: 'duration', label: 'Duration' }
                ]
            }
        });
    } catch (error) {
        console.error('Get search filters error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Popular searches endpoint
router.get('/popular', async (req, res) => {
    try {
        const db = await initDatabase();

        // Get most viewed videos (popular content)
        const popularVideos = await db.all(`
            SELECT v.*, c.name as categoryName
            FROM videos v
            LEFT JOIN categories c ON v.categoryId = c.id
            ORDER BY v.views DESC
            LIMIT 10
        `);

        // Get most used tags (trending tags)
        const trendingTags = await db.all(`
            SELECT t.*, COUNT(vt.videoId) as usage_count
            FROM tags t
            INNER JOIN video_tags vt ON t.id = vt.tagId
            GROUP BY t.id
            ORDER BY usage_count DESC
            LIMIT 10
        `);

        // Get categories with most content
        const popularCategories = await db.all(`
            SELECT c.*, COUNT(v.id) as video_count
            FROM categories c
            INNER JOIN videos v ON c.id = v.categoryId
            GROUP BY c.id
            ORDER BY video_count DESC
            LIMIT 5
        `);

        res.json({
            success: true,
            popular: {
                videos: popularVideos,
                tags: trendingTags,
                categories: popularCategories
            }
        });
    } catch (error) {
        console.error('Get popular searches error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;