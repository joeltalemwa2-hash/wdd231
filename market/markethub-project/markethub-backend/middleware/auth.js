const jwt = require('jsonwebtoken');
const User = require('../models/User');

// ===== Protect — requires valid JWT =====
exports.protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.token) {
      token = req.cookies.token;
    }
    if (!token) return res.status(401).json({ error: 'Not authenticated. Please log in.' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret_change_me');
    const user = await User.findById(decoded.id).select('+isActive');
    if (!user || !user.isActive) return res.status(401).json({ error: 'User not found or deactivated.' });

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return res.status(401).json({ error: 'Session expired. Please log in again.' });
    return res.status(401).json({ error: 'Invalid token.' });
  }
};

// ===== Optional Auth — attaches user if token present, continues otherwise =====
exports.optionalAuth = async (req, res, next) => {
  try {
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) {
      const token = auth.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret_change_me');
      req.user = await User.findById(decoded.id);
    }
  } catch {}
  next();
};

// ===== Restrict to roles =====
exports.restrict = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated.' });
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: `Access restricted to: ${roles.join(', ')}` });
  }
  next();
};

// ===== Sign token =====
exports.signToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET || 'dev_secret_change_me', {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });