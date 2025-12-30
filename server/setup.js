const { Database, User, Category, Video, Settings } = require('./models/index');
const path = require('path');

async function setupDatabase() {
    console.log('Setting up VisionHub database...');

    const database = new Database();

    try {
        await database.connect();

        // Create tables
        const tables = [
            `CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY,
                password TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'user',
                fullName TEXT,
                department TEXT,
                employeeId TEXT,
                email TEXT,
                phone TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS videos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT,
                thumbnailUrl TEXT,
                videoUrl TEXT NOT NULL,
                optimizedUrl TEXT,
                views INTEGER DEFAULT 0,
                isFeatured BOOLEAN DEFAULT 0,
                categoryId INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(categoryId) REFERENCES categories(id)
            )`,
            `CREATE TABLE IF NOT EXISTS user_favorites (
                userId TEXT,
                videoId INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (userId, videoId),
                FOREIGN KEY(userId) REFERENCES users(username),
                FOREIGN KEY(videoId) REFERENCES videos(id)
            )`,
            `CREATE TABLE IF NOT EXISTS comments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                videoId INTEGER,
                userId TEXT,
                text TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(videoId) REFERENCES videos(id),
                FOREIGN KEY(userId) REFERENCES users(username)
            )`,
            `CREATE TABLE IF NOT EXISTS reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId TEXT,
                videoId INTEGER,
                reason TEXT NOT NULL,
                custom_reason TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(userId) REFERENCES users(username),
                FOREIGN KEY(videoId) REFERENCES videos(id)
            )`,
            `CREATE TABLE IF NOT EXISTS logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId TEXT,
                action TEXT NOT NULL,
                details TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(userId) REFERENCES users(username)
            )`,
            `CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS report_reasons (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                reason TEXT NOT NULL UNIQUE,
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            // Additional tables for enterprise features
            `CREATE TABLE IF NOT EXISTS tags (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                description TEXT,
                color TEXT DEFAULT '#2563eb',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS video_tags (
                videoId INTEGER,
                tagId INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (videoId, tagId),
                FOREIGN KEY(videoId) REFERENCES videos(id) ON DELETE CASCADE,
                FOREIGN KEY(tagId) REFERENCES tags(id) ON DELETE CASCADE
            )`,
            `CREATE TABLE IF NOT EXISTS playlists (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                userId TEXT,
                is_public BOOLEAN DEFAULT 0,
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(userId) REFERENCES users(username)
            )`,
            `CREATE TABLE IF NOT EXISTS playlist_videos (
                playlistId INTEGER,
                videoId INTEGER,
                position INTEGER,
                added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (playlistId, videoId),
                FOREIGN KEY(playlistId) REFERENCES playlists(id) ON DELETE CASCADE,
                FOREIGN KEY(videoId) REFERENCES videos(id) ON DELETE CASCADE
            )`,
            `CREATE TABLE IF NOT EXISTS user_groups (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                description TEXT,
                color TEXT DEFAULT '#3b82f6',
                is_active BOOLEAN DEFAULT 1,
                created_by TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(created_by) REFERENCES users(username)
            )`,
            `CREATE TABLE IF NOT EXISTS user_group_members (
                group_id INTEGER,
                username TEXT,
                role_in_group TEXT DEFAULT 'member',
                added_by TEXT,
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (group_id, username),
                FOREIGN KEY(group_id) REFERENCES user_groups(id) ON DELETE CASCADE,
                FOREIGN KEY(username) REFERENCES users(username) ON DELETE CASCADE,
                FOREIGN KEY(added_by) REFERENCES users(username)
            )`,
            `CREATE TABLE IF NOT EXISTS permissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                description TEXT,
                category TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS user_permissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT,
                permission_id INTEGER,
                granted_by TEXT,
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(username, permission_id),
                FOREIGN KEY(username) REFERENCES users(username) ON DELETE CASCADE,
                FOREIGN KEY(permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
                FOREIGN KEY(granted_by) REFERENCES users(username)
            )`,
            `CREATE TABLE IF NOT EXISTS group_permissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                group_id INTEGER,
                permission_id INTEGER,
                granted_by TEXT,
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(group_id, permission_id),
                FOREIGN KEY(group_id) REFERENCES user_groups(id) ON DELETE CASCADE,
                FOREIGN KEY(permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
                FOREIGN KEY(granted_by) REFERENCES users(username)
            )`,
            `CREATE TABLE IF NOT EXISTS audit_trail (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId TEXT,
                action TEXT NOT NULL,
                resource_type TEXT,
                resource_id TEXT,
                old_values TEXT,
                new_values TEXT,
                ip_address TEXT,
                user_agent TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(userId) REFERENCES users(username)
            )`,
            `CREATE TABLE IF NOT EXISTS content_schedule (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                videoId INTEGER,
                publish_at DATETIME NOT NULL,
                action_type TEXT DEFAULT 'publish',
                scheduled_by TEXT,
                description TEXT,
                status TEXT DEFAULT 'pending',
                executed_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(videoId) REFERENCES videos(id),
                FOREIGN KEY(scheduled_by) REFERENCES users(username)
            )`,
            `CREATE TABLE IF NOT EXISTS password_policies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                min_length INTEGER DEFAULT 8,
                require_uppercase BOOLEAN DEFAULT 1,
                require_lowercase BOOLEAN DEFAULT 1,
                require_numbers BOOLEAN DEFAULT 1,
                require_special_chars BOOLEAN DEFAULT 1,
                max_age_days INTEGER DEFAULT 90,
                history_count INTEGER DEFAULT 5,
                lockout_attempts INTEGER DEFAULT 5,
                lockout_duration_minutes INTEGER DEFAULT 30,
                is_active BOOLEAN DEFAULT 0,
                created_by TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(created_by) REFERENCES users(username)
            )`
        ];

        console.log('Creating database tables...');
        for (const table of tables) {
            await database.run(table);
        }

        // Seed initial data
        console.log('Seeding initial data...');

        // Create default users
        try {
            await User.create(database, { username: 'admin', password: '123456', role: 'admin' });
            console.log('✓ Created admin user (username: admin, password: 123456)');
        } catch (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                console.log('✓ Admin user already exists');
            } else {
                throw err;
            }
        }

        try {
            await User.create(database, { username: 'user', password: '123456', role: 'user' });
            console.log('✓ Created test user (username: user, password: 123456)');
        } catch (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                console.log('✓ Test user already exists');
            } else {
                throw err;
            }
        }

        // Create default categories
        const categories = ['Development', 'Design', 'Marketing'];
        for (const categoryName of categories) {
            try {
                await Category.create(database, categoryName);
                console.log(`✓ Created category: ${categoryName}`);
            } catch (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    console.log(`✓ Category '${categoryName}' already exists`);
                } else {
                    throw err;
                }
            }
        }

        // Create default videos
        const videos = [
            {
                title: 'Introduction to Web Development',
                description: 'An introductory course to web development fundamentals, covering HTML, CSS, and JavaScript.',
                thumbnailUrl: 'https://placehold.co/400x225/2a9d8f/c9d1d9?text=WebDev',
                videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                categoryId: 1,
                isFeatured: true
            },
            {
                title: 'Getting Started with UI/UX Design',
                description: 'Learn the basics of user interface and user experience design.',
                thumbnailUrl: 'https://placehold.co/400x225/e9c46a/264653?text=UI/UX',
                videoUrl: 'https://www.youtube.com/watch?v=S01mP-mR8Ew',
                categoryId: 2,
                isFeatured: false
            },
            {
                title: 'The Power of Digital Marketing',
                description: 'A guide to digital marketing strategies and tools for your business.',
                thumbnailUrl: 'https://placehold.co/400x225/f4a261/264653?text=Marketing',
                videoUrl: 'https://www.youtube.com/watch?v=N_x011_x-wU',
                categoryId: 3,
                isFeatured: false
            },
            {
                title: 'JavaScript Advanced Concepts',
                description: 'Deep dive into advanced topics in JavaScript programming language.',
                thumbnailUrl: 'https://placehold.co/400x225/e76f51/264653?text=JS+Advanced',
                videoUrl: 'https://www.youtube.com/watch?v=XF-gqK7yB1A',
                categoryId: 1,
                isFeatured: false
            },
            {
                title: 'Introduction to Figma',
                description: 'Master the basics of Figma, a powerful tool for collaborative design.',
                thumbnailUrl: 'https://placehold.co/400x225/264653/e9c46a?text=Figma',
                videoUrl: 'https://www.youtube.com/watch?v=Ft7L7X7N-6o',
                categoryId: 2,
                isFeatured: false
            }
        ];

        for (const video of videos) {
            try {
                await Video.create(database, video);
                console.log(`✓ Created video: ${video.title}`);
            } catch (err) {
                console.log(`✓ Video '${video.title}' may already exist`);
            }
        }

        // Set initial views for some videos
        await database.run('UPDATE videos SET views = 1500 WHERE title = ?', ['Introduction to Web Development']);
        await database.run('UPDATE videos SET views = 800 WHERE title = ?', ['Getting Started with UI/UX Design']);
        await database.run('UPDATE videos SET views = 1200 WHERE title = ?', ['The Power of Digital Marketing']);
        await database.run('UPDATE videos SET views = 2500 WHERE title = ?', ['JavaScript Advanced Concepts']);
        await database.run('UPDATE videos SET views = 600 WHERE title = ?', ['Introduction to Figma']);

        // Create default settings
        await Settings.set(database, 'siteName', 'VisionHub');
        await Settings.set(database, 'primaryColor', '#2a9d8f');
        console.log('✓ Created default settings');

        // Create default report reasons
        const defaultReasons = [
            'Inappropriate content',
            'Spam',
            'Copyright violation',
            'Misleading content',
            'Violence or harmful content',
            'Hate speech',
            'Other'
        ];

        for (const reason of defaultReasons) {
            try {
                await database.run('INSERT OR IGNORE INTO report_reasons (reason) VALUES (?)', [reason]);
                console.log(`✓ Created report reason: ${reason}`);
            } catch (err) {
                console.log(`✓ Report reason '${reason}' already exists`);
            }
        }

        console.log('\n🎉 Database setup completed successfully!');
        console.log('\nDefault login credentials:');
        console.log('- Admin: username=admin, password=123456');
        console.log('- User: username=user, password=123456');

    } catch (error) {
        console.error('❌ Error setting up database:', error.message);
        process.exit(1);
    } finally {
        await database.close();
    }
}

// Run setup if this file is executed directly
if (require.main === module) {
    setupDatabase();
}

module.exports = { setupDatabase };