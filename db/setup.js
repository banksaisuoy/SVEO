            description TEXT,
            category TEXT,
            category_id INTEGER,
            video_url TEXT,
            thumbnail_url TEXT,
            file_path TEXT,
            thumbnail_path TEXT,
            duration INTEGER,
                };

                addColumn('category_id', 'INTEGER');
                addColumn('video_url', 'TEXT');
                addColumn('thumbnail_url', 'TEXT');
                addColumn('category', 'TEXT');
                addColumn('file_path', 'TEXT');
                addColumn('thumbnail_path', 'TEXT');
                addColumn('duration', 'INTEGER');