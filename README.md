# MySearch Hub

A personal search platform that allows users to organize and save their search topics with detailed descriptions. Users can create custom collections of topics they've searched for, providing an intuitive way to manage knowledge.

![MySearch Hub Screenshot](https://via.placeholder.com/800x450?text=MySearch+Hub+Screenshot)

## Live Demo

The application is deployed and accessible at: [https://mysearch-hub-production.up.railway.app/](https://mysearch-hub-production.up.railway.app/)

## Features

- **User Authentication**: 
  - Traditional email/password login
  - Google OAuth integration
  - JWT-based session management
- **Topic Management**:
  - Create topics with custom titles
  - Auto-fetch descriptions from Wikipedia API
  - Edit topic titles
  - Delete topics
  - Clear all topics at once
- **Responsive Design**: 
  - Mobile-friendly interface
  - Clean, intuitive UI

## Technology Stack

### Frontend
- **EJS** (Embedded JavaScript) for templating
- **CSS3** with responsive design principles
- **JavaScript** (ES6+) for client-side interactivity
- **Bootstrap** for styling components
- **Fetch API** for AJAX requests

### Backend
- **Node.js** - JavaScript runtime environment
- **Express.js** - Web application framework
- **Passport.js** - Authentication middleware
- **Bcrypt.js** - Password hashing
- **JSON Web Tokens** - Secure user sessions
- **Axios** - HTTP client for external API requests
- **Multer** - Handling file uploads
- **Cookie-Parser** - Parsing cookies for session management

### Database
- **PostgreSQL** - Production database (on Railway)
- **SQLite** - Development database
- **PG** - PostgreSQL client for Node.js
- **Connect-PG-Simple** - PostgreSQL session store

### APIs
- **Google OAuth API** - User authentication
- **Wikipedia API** - Fetching topic descriptions

### Deployment
- **Railway** - Cloud platform for hosting
- **Docker** - Containerization
- **Git/GitHub** - Version control
- **Environment Variables** - Secure configuration

## Local Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/mysearch-hub.git
   cd mysearch-hub
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up Google OAuth**:
   - Go to the [Google Cloud Console](https://console.cloud.google.com/).
   - Create a new project.
   - Set up OAuth 2.0 credentials.
   - Add `http://localhost:3000/auth/google/callback` as an authorized redirect URI.
   - Copy your `Client ID` and `Client Secret`.

4. **Configure the application**:
   - Open `app.js` and replace `'YOUR_GOOGLE_CLIENT_ID'` and `'YOUR_GOOGLE_CLIENT_SECRET'` with your Google OAuth credentials.

5. **Run the application**:
   ```bash
   npm start
   ```

## Project Structure

mysearch-hub/
├── [app.js](http://_vscodecontentref_/1)                  # Main application entry point
├── [database.js](http://_vscodecontentref_/2)             # Database configuration and models
├── public/                 # Static assets
│   ├── css/                # Stylesheets
│   ├── js/                 # Client-side JavaScript
│   └── images/             # Images and icons
├── views/                  # EJS templates
│   ├── dashboard.ejs       # Main user interface
│   ├── login.ejs           # Login page
│   ├── [register.ejs](http://_vscodecontentref_/3)        # Registration page
│   ├── error.ejs           # Error page
│   └── redirect.ejs        # OAuth redirect handler
├── node_modules/           # Dependencies
├── [package.json](http://_vscodecontentref_/4)            # Project metadata and dependencies
├── [package-lock.json](http://_vscodecontentref_/5)       # Dependency lock file
├── .env                    # Environment variables (not in version control)
├── .gitignore              # Git ignore file
├── Procfile                # Process file for Railway
├── [nixpacks.toml](http://_vscodecontentref_/6)           # Nixpacks configuration
└── [README.md](http://_vscodecontentref_/7)               # Project documentation
