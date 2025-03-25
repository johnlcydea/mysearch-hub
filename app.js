const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { Database } = require('./database');
const axios = require('axios');
require('dotenv').config();

const app = express();
const db = new Database();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

// Passport configuration
app.use(passport.initialize());
app.use(passport.session());

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: 'http://localhost:3000/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
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

app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile'] })
);

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    req.session.user = { 
      id: req.user.id, 
      username: req.user.username, 
      displayName: req.user.displayName || req.user.username 
    };
    res.redirect('/dashboard');
  }
);

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

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});