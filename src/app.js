// Load environment variables
require('dotenv').config({ path: '.env' });

const express = require('express');
const session = require('express-session');
const cors = require('cors');
const { initializeDb } = require('./db/database');

// Initialize the database for non-test environments
if (process.env.NODE_ENV !== 'test') {
    initializeDb();
}

// Import routes
const authRoutes = require('./routes/auth');
const videoRoutes = require('./routes/videos');
const categoryRoutes = require('./routes/categories');
const userRoutes = require('./routes/users'); // For admin user management
const tagRoutes = require('./routes/tags');
const permissionRoutes = require('./routes/permissions');

const app = express();

// Middleware setup
app.use(cors());
app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET || 'sveo-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Serve static files from the "public" directory
app.use(express.static('public'));

// Use API routes
app.use('/api', authRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/permissions', permissionRoutes);

// A simple error handling middleware (optional, but good practice)
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

module.exports = app;
