const { protect, adminOnly } = require('./authMiddleware');

// Middleware to check if user is admin
// Combines protect (JWT verification) and adminOnly (role check)
const adminAuth = [protect, adminOnly];

module.exports = adminAuth;
