# MySearch Hub

A web application that allows users to log in with Google, search for terms, save the searches with custom titles, and view Wikipedia summaries for each search. Users can edit or delete their searches via a modal and clear all searches at once.

## Features
- Google OAuth login
- Search functionality with custom titles
- Wikipedia summaries for search terms
- Edit and delete searches via a modal
- Clear all searches option
- Responsive design
- Loading spinner on login
- Glitch effect on the login page title

## Setup Instructions

1. **Clone the repository**:

git clone <repository-url>
cd mysearch-hub


2. **Install dependencies**:

npm install

3. **Set up Google OAuth**:
- Go to the [Google Cloud Console](https://console.cloud.google.com/).
- Create a new project.
- Set up OAuth 2.0 credentials.
- Add `http://localhost:3000/auth/google/callback` as an authorized redirect URI.
- Copy your `Client ID` and `Client Secret`.

4. **Configure the application**:
- Open `app.js` and replace `'YOUR_GOOGLE_CLIENT_ID'` and `'YOUR_GOOGLE_CLIENT_SECRET'` with your Google OAuth credentials.

5. **Run the application**: