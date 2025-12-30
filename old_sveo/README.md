# VisionHub - Video Content Management System

A complete, modern web application for video content management with an advanced admin panel. Built with Node.js, Express, SQLite, and vanilla JavaScript.

## Features

### Core Functionality
- **User Authentication**: Secure login system with JWT tokens
- **Video Management**: Complete CRUD operations for video content
- **Category System**: Organize videos into categories
- **User Roles**: Admin and regular user roles with different permissions
- **Featured Videos**: Rotating carousel for highlighted content
- **Search & Discovery**: Real-time search and trending videos
- **Favorites System**: Users can bookmark their favorite videos
- **Comments**: Interactive commenting system for videos
- **Reporting**: Users can report inappropriate content

### Admin Panel Features
- **User Management**: Create, edit, and manage user accounts
- **Video Administration**: Full video lifecycle management
- **Category Management**: Create and organize content categories
- **Reports & Logs**: Review user reports and system activity
- **Site Settings**: Customize site appearance and configuration
- **Analytics**: View video statistics and user engagement

### Technical Features
- **RESTful API**: Well-structured API endpoints
- **Persistent Database**: SQLite3 for reliable data storage
- **Responsive Design**: Mobile-friendly interface
- **Modern CSS**: Custom styling without external frameworks
- **Video Embedding**: Support for YouTube, Google Drive, and direct video files
- **Real-time Updates**: Dynamic content loading without page refreshes

## Installation & Setup

### Prerequisites
- **Node.js**: Version 14.0.0 or higher
- **npm**: Comes with Node.js

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Initialize Database
```bash
npm run setup
```

This command will:
- Create the SQLite database
- Set up all required tables
- Insert sample data
- Create default user accounts

### Step 3: Start the Application
```bash
# For development (with auto-restart)
npm run dev

# For production
npm start
```

The application will be available at: `http://localhost:3000`

### Default Login Credentials
- **Admin Account**
  - Username: `admin`
  - Password: `123456`

- **Regular User Account**
  - Username: `user`
  - Password: `123456`

## Project Structure

```
visionhub-video-cms/
├── package.json              # Project dependencies and scripts
├── server/                   # Backend application
│   ├── server.js            # Main server file
│   ├── models/            # Database models and queries
│   │   ├── index.js
│   │   ├── Database.js
│   │   ├── User.js
│   │   ├── Video.js
│   │   ├── Category.js
│   │   ├── Favorite.js
│   │   ├── Comment.js
│   │   ├── Report.js
│   │   ├── Log.js
│   │   ├── Settings.js
│   │   ├── ReportReason.js
│   │   ├── UserGroup.js
│   │   ├── Permission.js
│   │   ├── PasswordPolicy.js
│   │   ├── Tag.js
│   │   ├── Playlist.js
│   │   ├── ContentSchedule.js
│   │   └── AuditTrail.js
│   ├── setup.js             # Database initialization script
│   ├── visionhub.db         # SQLite database (created after setup)
│   └── routes/              # API route handlers
│       ├── index.js         # Main routes file
│       ├── auth.js          # Authentication routes
│       ├── videos.js        # Video management routes
│       ├── categories.js    # Category management routes
│       ├── users.js         # User management routes
│       ├── favorites.js     # Favorites system routes
│       ├── comments.js      # Comment system routes
│       ├── reports.js       # Reporting system routes
│       ├── logs.js          # Activity logging routes
│       └── settings.js      # Site settings routes
└── public/                  # Frontend application
    ├── index.html           # Main HTML file
    ├── css/
    │   └── styles.css       # Custom CSS styles
    └── js/
        ├── app.js           # Main application logic
        ├── app-handlers.js  # Event handlers and utilities
        └── app-admin.js     # Admin panel functionality
```

## API Documentation

The application provides a comprehensive RESTful API. Access the API documentation at:
- **Development**: `http://localhost:3000/api/docs`
- **Health Check**: `http://localhost:3000/api/health`

### Authentication Endpoints
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/verify` - Verify JWT token

### Video Endpoints
- `GET /api/videos` - Get all videos
- `GET /api/videos/featured` - Get featured videos
- `GET /api/videos/trending` - Get trending videos
- `GET /api/videos/search?q=query` - Search videos
- `GET /api/videos/:id` - Get specific video
- `POST /api/videos/:id/view` - Record video view
- `POST /api/videos` - Create video (admin)
- `PUT /api/videos/:id` - Update video (admin)
- `DELETE /api/videos/:id` - Delete video (admin)

### Additional Endpoints
For complete API documentation, visit `/api/docs` when the server is running.

## Usage Guide

### For Regular Users

#### 1. Login
- Visit the application homepage
- Enter your username and password
- Click \"Log In\"

#### 2. Browse Videos
- View featured videos in the rotating carousel
- Browse trending videos
- Explore videos by category
- Use the search bar to find specific content

#### 3. Watch Videos
- Click on any video card to view
- Use video controls for playback
- Add videos to favorites using the heart icon
- Leave comments below the video
- Report inappropriate content if necessary

#### 4. Manage Favorites
- Click \"Favorites\" in the header
- View all your bookmarked videos
- Click any video to watch

### For Administrators

#### 1. Access Admin Panel
- Login with admin credentials
- Click the settings icon in the header
- Navigate through different management tabs

#### 2. User Management
- View all registered users
- Create new user accounts
- Change user roles (admin/user)

#### 3. Video Management
- View all videos with statistics
- Add new videos with details
- Edit existing video information
- Delete videos from the system
- Set featured status for videos

#### 4. Category Management
- Create new categories
- Edit existing categories
- Delete unused categories
- View videos per category

#### 5. Reports & Monitoring
- Review user-submitted reports
- Resolve reports by taking action
- Monitor system activity logs
- Track user engagement

#### 6. Site Configuration
- Customize site name
- Change primary color theme
- Save configuration changes

## Database Schema

### Users Table
- `username` (TEXT, PRIMARY KEY)
- `password` (TEXT, hashed with bcrypt)
- `role` (TEXT: 'user' or 'admin')
- `created_at` (DATETIME)

### Videos Table
- `id` (INTEGER, PRIMARY KEY)
- `title` (TEXT)
- `description` (TEXT)
- `thumbnailUrl` (TEXT)
- `videoUrl` (TEXT)
- `views` (INTEGER)
- `isFeatured` (BOOLEAN)
- `categoryId` (INTEGER, FOREIGN KEY)
- `created_at` (DATETIME)

### Categories Table
- `id` (INTEGER, PRIMARY KEY)
- `name` (TEXT, UNIQUE)
- `created_at` (DATETIME)

### Additional Tables
- `user_favorites` - User's favorite videos
- `comments` - Video comments
- `reports` - User reports
- `logs` - System activity logs
- `settings` - Site configuration

## Security Features

- **Password Hashing**: bcrypt with salt rounds
- **JWT Authentication**: Secure token-based authentication
- **Input Validation**: Server-side validation for all inputs
- **SQL Injection Prevention**: Parameterized queries
- **Role-based Access Control**: Admin vs. user permissions
- **Activity Logging**: Comprehensive audit trail

## Customization

### Adding New Video Sources
Edit the `getVideoEmbed` function in `public/js/app-handlers.js` to support additional video platforms.

### Styling Modifications
Customize the appearance by editing `public/css/styles.css`. The CSS uses CSS custom properties (variables) for easy theming.

### Database Modifications
Update `server/models/` and `server/setup.js` if you need to modify the database schema.

## Troubleshooting

### Common Issues

#### Database Issues
```bash
# Reset database
rm server/visionhub.db
npm run setup
```

#### Permission Errors
- Ensure the server directory is writable
- Check that SQLite can create database files

#### Port Already in Use
- Change the PORT environment variable
- Or modify the port in `server/server.js`

#### API Errors
- Check the browser's developer console
- Verify the server is running
- Check API endpoint URLs

### Development Mode
```bash
# Start with automatic restart on changes
npm run dev

# View detailed logs
DEBUG=* npm run dev
```

## Production Deployment

### Environment Variables
```bash
# Set in production
export NODE_ENV=production
export JWT_SECRET=your-secure-secret-key
export PORT=3000
```

### Security Considerations
- Change default passwords immediately
- Use strong JWT secret keys
- Enable HTTPS in production
- Implement rate limiting
- Regular database backups

### Performance Optimization
- Enable gzip compression
- Implement caching strategies
- Optimize database queries
- Use CDN for static assets

## Support & Contributing

### Getting Help
- Check the troubleshooting section
- Review the API documentation
- Examine browser console for errors

### Feature Requests
- Document desired functionality
- Consider backwards compatibility
- Test with existing data

### Bug Reports
- Provide detailed reproduction steps
- Include error messages and logs
- Specify environment details

---

**VisionHub** - A modern, feature-rich video content management system.
Built with ❤️ using Node.js, Express, and vanilla JavaScript.