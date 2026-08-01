const isAuthenticated = (req, res, next) => {
    if (req.session.isAuthenticated) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized: You must be logged in to access this resource.' });
    }
};

const isAdmin = (req, res, next) => {
    if (req.session.isAuthenticated && req.session.user && req.session.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ error: 'Forbidden' });
    }
};

module.exports = {
    isAuthenticated,
    isAdmin
};