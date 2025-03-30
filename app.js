require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Database } = require('./database');
const axios = require('axios');
const multer = require('multer');
const cookieParser = require('cookie-parser');

// Initialize app
const app = express();
const db = new Database();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');

// Add this near the top of your file
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Middleware for production
app.set('trust proxy', 1); // Trust first proxy for Railway

// Add this middleware for production redirects
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect(`https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'default-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize passport
app.use(passport.initialize());
app.use(passport.session());
app.use(cookieParser());

// Update your existing callback URL definition
const callbackURL = (() => {
  // Default development callback
  let url = 'http://localhost:3000/auth/google/callback';
  
  // If in production, use the Railway URL
  if (process.env.NODE_ENV === 'production') {
    url = 'https://mysearch-hub-production.up.railway.app/auth/google/callback';
  }
  
  console.log('Using Google callback URL:', url);
  return url;
})();

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: callbackURL
}, async (accessToken, refreshToken, profile, done) => {
  console.log('Google OAuth callback received. Profile:', profile.id, profile.displayName);
  try {
    let user = await db.findUserByUsername(profile.id);
    if (!user) {
      const newUser = {
        username: profile.id,
        password: 'google-auth',
        displayName: profile.displayName
      };
      const userId = await db.registerUser(newUser.username, newUser.password, newUser.displayName);
      user = { id: userId, ...newUser };
    }
    return done(null, user);
  } catch (err) {
    return done(err, null);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await db.findUserById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
  console.log('isAuthenticated middleware - Session:', req.session);
  if (req.session.user || req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
}

// Routes
app.get('/', (req, res) => {
  res.redirect('/login');
});

app.get('/login', (req, res) => {
  const error = req.session.error || null;
  const success = req.session.success || null;
  req.session.error = null;
  req.session.success = null;
  res.render('login', { error, success });
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  console.log('Login attempt - Username:', username, 'Password:', password);

  try {
    const user = await db.findUserByUsername(username);
    console.log('User found in database:', user);

    if (!user) {
      console.log('User not found in database');
      req.session.error = 'Invalid username or password';
      return res.redirect('/login');
    }

    console.log('Stored hashed password:', user.password);
    const match = await bcrypt.compare(password, user.password);
    console.log('Password match result:', match);

    if (!match) {
      console.log('Password does not match');
      req.session.error = 'Invalid username or password';
      return res.redirect('/login');
    }

    req.session.user = { 
      id: user.id, 
      username: user.username, 
      displayName: user.displayName || user.username 
    };
    console.log('Session set after login:', req.session);

    req.session.success = 'Login successful!';
    return res.redirect('/dashboard');
  } catch (err) {
    console.error('Login error:', err);
    req.session.error = 'An error occurred during login';
    return res.redirect('/login');
  }
});

app.get('/register', (req, res) => {
  const error = req.session.error || null;
  const success = req.session.success || null;
  req.session.error = null;
  req.session.success = null;
  res.render('register', { error, success });
});

app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const existingUser = await db.findUserByUsername(username);
    if (existingUser) {
      req.session.error = 'Username already exists';
      return res.redirect('/register');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await db.registerUser(username, hashedPassword);
    req.session.success = 'Registration successful! Please log in.';
    return res.redirect('/login');
  } catch (err) {
    console.error('Registration error:', err);
    req.session.error = 'An error occurred during registration';
    return res.redirect('/register');
  }
});

// Update your existing Google auth route
app.get('/auth/google', (req, res, next) => {
  // Store the current environment and redirect preference
  req.session.authEnv = process.env.NODE_ENV || 'development';
  req.session.authRedirect = req.query.redirect || 'development';
  
  // Log the auth attempt
  console.log(`Starting Google auth in ${req.session.authEnv} environment`);
  console.log(`Using callback URL: ${callbackURL}`);
  console.log(`Redirect preference: ${req.session.authRedirect}`);
  
  passport.authenticate('google', { 
    scope: ['profile'],
    callbackURL: callbackURL
  })(req, res, next);
});

// Update your callback route
app.get('/auth/google/callback', (req, res, next) => {
  console.log('Google callback received. Query params:', req.query);
  console.log('Auth environment:', req.session?.authEnv || 'unknown');
  console.log('Redirect preference:', req.session?.authRedirect || 'unknown');
  
  // Check if we're on localhost but should be on production
  if (req.hostname === 'localhost' && 
      req.session?.authRedirect === 'production') {
    console.log('Environment mismatch detected - redirecting to production');
    return res.redirect('/local-to-prod-redirect' + req.url.replace('/auth/google/callback', ''));
  }
  
  // Continue with normal authentication
  passport.authenticate('google', { 
    failureRedirect: '/login',
    callbackURL: callbackURL
  }, (err, user, info) => {
    if (err) {
      console.error('Google auth error:', err);
      return res.redirect('/login');
    }
    
    if (!user) {
      console.error('No user returned from Google auth. Info:', info);
      return res.redirect('/login');
    }
    
    // Log the user object
    console.log('Google auth successful. User:', user);
    
    // Login the user
    req.login(user, (err) => {
      if (err) {
        console.error('Error in req.login:', err);
        return res.redirect('/login');
      }
      
      // Ensure user is properly stored in session
      req.session.user = { 
        id: user.id, 
        username: user.username, 
        displayName: user.displayName || user.username 
      };
      
      // Make sure session is saved before redirecting
      req.session.save((err) => {
        if (err) {
          console.error('Error saving session:', err);
        }
        console.log('Redirecting to dashboard after successful Google auth');
        res.redirect('/dashboard');
      });
    });
  })(req, res, next);
});

app.get('/dashboard', isAuthenticated, async (req, res) => {
  try {
    const user = req.session.user || req.user;
    console.log('Dashboard - User:', user);
    const searches = await db.getSearches(user.id);
    const message = req.session.message || null;
    const messageType = req.session.messageType || null;
    req.session.message = null;
    req.session.messageType = null;
    res.render('dashboard', { user, searches, message, messageType });
  } catch (err) {
    console.error('Dashboard error:', err);
    req.session.error = 'An error occurred while loading the dashboard';
    res.redirect('/login');
  }
});

app.post('/dashboard', isAuthenticated, async (req, res) => {
  const { query, title } = req.body;
  const user = req.session.user || req.user;
  let definition = 'No information found'; // Default placeholder

  try {
    // Normalize the query: capitalize first letter of each word
    const normalizedQuery = query
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    console.log('Normalized Wikipedia API query:', normalizedQuery);

    // Try to fetch a summary directly
    let wikiResponse = await axios.get('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(normalizedQuery));
    console.log('Wikipedia API direct response:', wikiResponse.data);

    // If no extract is found, fall back to search
    if (!wikiResponse.data.extract) {
      console.log('No direct match found, falling back to search...');
      const searchResponse = await axios.get('https://en.wikipedia.org/w/api.php', {
        params: {
          action: 'query',
          list: 'search',
          srsearch: normalizedQuery,
          format: 'json'
        }
      });
      console.log('Wikipedia search response:', searchResponse.data);
      if (searchResponse.data.query && searchResponse.data.query.search && searchResponse.data.query.search.length > 0) {
        const firstResult = searchResponse.data.query.search[0].title;
        console.log('Found related page:', firstResult);
        wikiResponse = await axios.get('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(firstResult));
        console.log('Wikipedia API response for related page:', wikiResponse.data);
      }
    }

    if (wikiResponse.data && wikiResponse.data.extract) {
      // Truncate to first 2 sentences for brevity
      definition = wikiResponse.data.extract.split('. ').slice(0, 2).join('. ') + '.' || 'No information found';
    }
    console.log('Definition set to:', definition);
    await db.insertSearch(user.id, query, title, definition);
    req.session.message = 'Topic added successfully!';
    req.session.messageType = 'success';
  } catch (err) {
    console.error('Error fetching Wikipedia summary:', err.response ? err.response.data : err.message);
    await db.insertSearch(user.id, query, title, definition);
    req.session.message = 'Could not fetch description, but topic saved with placeholder.';
    req.session.messageType = 'success';
  }
  res.redirect('/dashboard');
});

app.post('/edit/:id', isAuthenticated, async (req, res) => {
  const { id } = req.params;
  const { title } = req.body;
  try {
    await db.updateSearchTitle(id, title);
    req.session.message = 'Topic updated successfully!';
    req.session.messageType = 'success';
  } catch (err) {
    console.error('Error updating topic:', err);
    req.session.message = 'Error updating topic';
    req.session.messageType = 'error';
  }
  res.redirect('/dashboard');
});

app.post('/delete/:id', isAuthenticated, async (req, res) => {
  const { id } = req.params;
  try {
    await db.deleteSearch(id);
    req.session.message = 'Topic deleted successfully!';
    req.session.messageType = 'success';
  } catch (err) {
    console.error('Error deleting topic:', err);
    req.session.message = 'Error deleting topic';
    req.session.messageType = 'error';
  }
  res.redirect('/dashboard');
});

app.post('/clear-searches', isAuthenticated, async (req, res) => {
  const user = req.session.user || req.user;
  try {
    await db.clearSearches(user.id);
    req.session.message = 'All topics cleared successfully!';
    req.session.messageType = 'success';
  } catch (err) {
    console.error('Error clearing topics:', err);
    req.session.message = 'Error clearing topics';
    req.session.messageType = 'error';
  }
  res.redirect('/dashboard');
});

app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    res.redirect('/login');
  });
});

// Add this route to help with redirection between environments
app.get('/redirect', (req, res) => {
  res.render('redirect');
});

// Handle case when we hit localhost callback in a production environment
app.get('/local-to-prod-redirect', (req, res) => {
  // Copy all query parameters from the original request
  const queryString = Object.keys(req.query)
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(req.query[key])}`)
    .join('&');
  
  // Log the redirect attempt
  console.log('Redirecting from localhost to production. Query params:', req.query);
  
  // Redirect to the production URL with the same query parameters
  const productionURL = `https://mysearch-hub-production.up.railway.app/auth/google/callback?${queryString}`;
  
  res.render('redirect', { productionURL });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).render('error', { 
    message: 'An error occurred', 
    error: process.env.NODE_ENV === 'production' ? {} : err 
  });
});

// At the bottom of your app.js file
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});