const jwt = require('jsonwebtoken');

const isAuthenticated = (req, res, next) => {
    // Check if session exists and has a user object
    if (req.session && req.session.user) {
        req.user = req.session.user;
        return next();
    }
    
    // Check for JWT token in Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_jwt_secret');
            req.user = decoded;
            return next();
        } catch (err) {
            return res.status(401).json({ error: 'Invalid token' });
        }
    }

    return res.status(401).json({ error: 'Unauthorized' });
};

const isAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(403).json({ error: 'Forbidden: User not authenticated' });
    }
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
    next();
};

module.exports = {
    isAuthenticated,
    isAdmin
};