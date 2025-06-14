// config/passport.js
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const { User, Stats, Inventory, PlayerLevel } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

// JWT Strategy (for API authentication)
passport.use(new JwtStrategy({
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: JWT_SECRET
}, async (payload, done) => {
  try {
    const user = await User.findById(payload.id).select('-password');
    if (user) {
      return done(null, user);
    }
    return done(null, false);
  } catch (error) {
    return done(error, false);
  }
}));

// Google OAuth Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
  try {
    console.log('Google OAuth callback received for user:', profile.displayName);
    
    // Check if user already exists with this Google ID
    let user = await User.findOne({ googleId: profile.id });
    
    if (user) {
      console.log('Existing Google user found:', user.username);
      return done(null, user);
    }
    
    // Check if user exists with same email (link accounts)
    user = await User.findOne({ email: profile.emails[0].value });
    
    if (user) {
      // Link existing account with Google
      console.log('Linking existing account with Google:', user.username);
      user.googleId = profile.id;
      user.provider = 'google';
      await user.save();
      return done(null, user);
    }
    
    // Create new user
    console.log('Creating new Google user:', profile.displayName);
    
    const newUser = new User({
      googleId: profile.id,
      username: profile.displayName || profile.emails[0].value.split('@')[0],
      email: profile.emails[0].value,     
      provider: 'google',
      characterClass: null // User will need to select character
    });
    
    await newUser.save();
    
    // Create initial game data
    await Stats.create({ userId: newUser._id });
    await Inventory.create({ userId: newUser._id, gold: 1000 });
    await PlayerLevel.create({ userId: newUser._id, level: 1, totalXP: 0 });
    
    console.log('New Google user created successfully:', newUser.username);
    return done(null, newUser);
    
  } catch (error) {
    console.error('Error in Google OAuth strategy:', error);
    return done(error, null);
  }
}));

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user._id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id).select('-password');
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;