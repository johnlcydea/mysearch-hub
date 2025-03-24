const sqlite3 = require('sqlite3').verbose();

class Database {
  constructor() {
    this.db = new sqlite3.Database('database.db', (err) => {
      if (err) {
        console.error('Error opening database:', err.message);
      } else {
        console.log('Connected to SQLite database.');
        this.initialize();
      }
    });
  }

  initialize() {
    // Drop the existing users table to recreate it with the new schema
    this.db.run('DROP TABLE IF EXISTS users', (err) => {
      if (err) {
        console.error('Error dropping users table:', err.message);
      }
    });

    this.db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        displayName TEXT
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS searches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        query TEXT NOT NULL,
        title TEXT NOT NULL,
        definition TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      )
    `);
  }

  async registerUser(username, password, displayName = username) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO users (username, password, displayName) VALUES (?, ?, ?)',
        [username, password, displayName],
        function (err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.lastID);
          }
        }
      );
    });
  }

  async findUserByUsername(username) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM users WHERE username = ?',
        [username],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        }
      );
    });
  }

  async findUserById(id) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM users WHERE id = ?',
        [id],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        }
      );
    });
  }

  async insertSearch(userId, query, title, definition) {
    const timestamp = Date.now();
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO searches (user_id, query, title, definition, timestamp) VALUES (?, ?, ?, ?, ?)',
        [userId, query, title, definition, timestamp],
        function (err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.lastID);
          }
        }
      );
    });
  }

  async getSearches(userId) {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM searches WHERE user_id = ? ORDER BY timestamp DESC',
        [userId],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            const searches = rows.map(row => ({
              ...row,
              timestamp: Number(row.timestamp)
            }));
            resolve(searches);
          }
        }
      );
    });
  }

  async updateSearchTitle(id, title) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE searches SET title = ? WHERE id = ?',
        [title, id],
        function (err) {
          if (err) {
            reject(err);
          } else {
            if (this.changes === 0) {
              reject(new Error('No search found with the given ID'));
            } else {
              resolve();
            }
          }
        }
      );
    });
  }

  async deleteSearch(id) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'DELETE FROM searches WHERE id = ?',
        [id],
        function (err) {
          if (err) {
            reject(err);
          } else {
            if (this.changes === 0) {
              reject(new Error('No search found with the given ID'));
            } else {
              resolve();
            }
          }
        }
      );
    });
  }

  async clearSearches(userId) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'DELETE FROM searches WHERE user_id = ?',
        [userId],
        function (err) {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Database connection closed.');
          resolve();
        }
      });
    });
  }
}

module.exports = { Database };