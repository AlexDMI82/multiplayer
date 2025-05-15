// auth.js - Authentication middleware

const jwt = require('jsonwebtoken');
const { User } = require('./models');

// Secret key for JWT
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

// Create JWT token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '7d' });
};

// Middleware to authenticate requests
const authenticate = async (req, res, next) => {
  try {
    // Get token from header or cookie
    const token = req.header('Authorization')?.replace('Bearer ', '') || req.cookies.token;
    
    if (!token) {
      // Redirect to login page for web routes
      if (req.path.endsWith('.html') || req.path === '/profile') {
        return res.redirect('/login.html');
      }
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);
    
    if (!user) {
      // Redirect to login page for web routes
      if (req.path.endsWith('.html') || req.path === '/profile') {
        return res.redirect('/login.html');
      }
      return res.status(401).json({ message: 'User not found' });
    }
    
    // Attach user to request object
    req.user = user;
    next();
  } catch (error) {
    // Redirect to login page for web routes
    if (req.path.endsWith('.html') || req.path === '/profile') {
      return res.redirect('/login.html');
    }
    res.status(401).json({ message: 'Invalid token' });
  }
};

// Socket.io authentication middleware - Made optional
const socketAuth = (socket, next) => {
  // Get token from socket handshake 
  const token = socket.handshake.auth?.token;
  
  // No token is okay for initial connection
  if (!token) {
    socket.userId = null; // Set to null to indicate not authenticated
    return next(); // Allow connection, auth will happen later
  }
  
  try {
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.userId = decoded.id; // Set userId on socket
    next();
  } catch (error) {
    // Still allow connection but with null userId
    socket.userId = null;
    next();
  }
};

module.exports = {
  generateToken,
  authenticate,
  socketAuth,
  JWT_SECRET // Export for use in socket.io authentication
};