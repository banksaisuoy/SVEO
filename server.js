const session = require('express-session');
const bcrypt = require('bcrypt');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const csurf = require('csurf');
const { isAuthenticated, isAdmin } = require('./src/middleware/auth');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
// fs and path already declared above for early logging
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const multer = require('multer');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(helmet());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));



app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback_secret',
    resave: false,
    cookie: { secure: false }
}));

const csrfProtection = csurf({ cookie: false });

// Serve CSRF token to clients
app.get('/api/csrf-token', csrfProtection, (req, res) => {
    res.status(200).json({ csrfToken: req.csrfToken() });
});

// Apply CSRF protection conditionally to mutating methods
app.use((req, res, next) => {
    if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
        return csrfProtection(req, res, next);
    }
    next();
});

const dbPath = require('path').join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
});

// Mount new routes
app.use('/api/videos', require('./routes/videos')(db, uploadMiddleware, isAdmin, isAuthenticated));
app.use('/api/admin', require('./routes/admin')(db, uploadMiddleware, isAdmin, isAuthenticated));
app.use('/api/categories', require('./routes/categories')(db, isAdmin, isAuthenticated));

// Start the server
app.listen(port, () => {