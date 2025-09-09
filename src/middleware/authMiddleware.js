const isAuthenticated = (req, res, next) => {
    // Check if user is stored in session
    if (req.session.user) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized: You must be logged in.' });
    }
};

const isAdmin = (req, res, next) => {
    // Check if the logged-in user has the 'admin' role
    if (req.session.user && req.session.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ error: 'Forbidden: You do not have admin privileges.' });
    }
};

module.exports = {
    isAuthenticated,
    isAdmin
};
