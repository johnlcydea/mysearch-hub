const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

class Database {
  constructor() {
    if (process.env.DATABASE_URL) {
      // Use PostgreSQL in production
      console.log('Connecting to PostgreSQL database...');
      this.usePostgres = true;
      try {
        // Fix: Parse the DATABASE_URL to ensure we're not using localhost
        const dbUrl = new URL(process.env.DATABASE_URL);
        console.log(`Connecting to PostgreSQL at ${dbUrl.hostname}:${dbUrl.port}...`);
        
        this.pool = new Pool({
          connectionString: process.env.DATABASE_URL,
          ssl: { rejectUnauthorized: false }
        });
        console.log('PostgreSQL connection pool created');
      } catch (err) {
        console.error('Error connecting to PostgreSQL:', err);
        // Fallback to SQLite if PostgreSQL connection fails
        console.log('Falling back to SQLite due to PostgreSQL connection failure');
        this.usePostgres = false;
        this.db = new sqlite3.Database(':memory:'); // Use in-memory SQLite as fallback
        this.initSqliteTables();
      }
    } else {
      // Use SQLite in development
      console.log('Connecting to SQLite database...');
      this.usePostgres = false;
      this.db = new sqlite3.Database('./database.sqlite');
      this.initTables();
    }
  }

  async initTables() {
    if (this.usePostgres) {
      // PostgreSQL table creation
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          "displayName" TEXT
        )
      `);
      
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS searches (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          query TEXT NOT NULL,
          title TEXT NOT NULL,
          definition TEXT,
          thumbnail TEXT,
          image_url TEXT,
          timestamp BIGINT
        )
      `);
    } else {
      // SQLite table creation
      this.db.serialize(() => {
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
            user_id INTEGER NOT NULL,
            query TEXT NOT NULL,
            title TEXT NOT NULL,
            definition TEXT,
            thumbnail TEXT,
            image_url TEXT,
            timestamp INTEGER
          )
        `);
      });
    }
  }

  // User methods
  async registerUser(username, password, displayName = null) {
    if (this.usePostgres) {
      const result = await this.pool.query(
        'INSERT INTO users (username, password, "displayName") VALUES ($1, $2, $3) RETURNING id',
        [username, password, displayName]
      );
      return result.rows[0].id;
    } else {
      return new Promise((resolve, reject) => {
        this.db.run(
          'INSERT INTO users (username, password, displayName) VALUES (?, ?, ?)',
          [username, password, displayName],
          function(err) {
            if (err) reject(err);
            resolve(this.lastID);
          }
        );
      });
    }
  }

  async findUserByUsername(username) {
    if (this.usePostgres) {
      const result = await this.pool.query(
        'SELECT id, username, password, "displayName" FROM users WHERE username = $1',
        [username]
      );
      return result.rows[0] || null;
    } else {
      return new Promise((resolve, reject) => {
        this.db.get(
          'SELECT id, username, password, displayName FROM users WHERE username = ?',
          [username],
          (err, row) => {
            if (err) reject(err);
            resolve(row || null);
          }
        );
      });
    }
  }

  async findUserById(id) {
    if (this.usePostgres) {
      const result = await this.pool.query(
        'SELECT id, username, password, "displayName" FROM users WHERE id = $1',
        [id]
      );
      return result.rows[0] || null;
    } else {
      return new Promise((resolve, reject) => {
        this.db.get(
          'SELECT id, username, password, displayName FROM users WHERE id = ?',
          [id],
          (err, row) => {
            if (err) reject(err);
            resolve(row || null);
          }
        );
      });
    }
  }

  // Search methods
  async insertSearch(userId, query, title, definition, thumbnail = null, imageUrl = null) {
    const timestamp = Date.now();
    
    if (this.usePostgres) {
      const result = await this.pool.query(
        'INSERT INTO searches (user_id, query, title, definition, thumbnail, image_url, timestamp) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
        [userId, query, title, definition, thumbnail, imageUrl, timestamp]
      );
      return result.rows[0].id;
    } else {
      return new Promise((resolve, reject) => {
        this.db.run(
          'INSERT INTO searches (user_id, query, title, definition, thumbnail, image_url, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [userId, query, title, definition, thumbnail, imageUrl, timestamp],
          function(err) {
            if (err) reject(err);
            resolve(this.lastID);
          }
        );
      });
    }
  }

  async getSearches(userId) {
    if (this.usePostgres) {
      const result = await this.pool.query(
        'SELECT * FROM searches WHERE user_id = $1 ORDER BY timestamp DESC',
        [userId]
      );
      return result.rows;
    } else {
      return new Promise((resolve, reject) => {
        this.db.all(
          'SELECT * FROM searches WHERE user_id = ? ORDER BY timestamp DESC',
          [userId],
          (err, rows) => {
            if (err) reject(err);
            resolve(rows || []);
          }
        );
      });
    }
  }

  async updateSearchTitle(id, title) {
    if (this.usePostgres) {
      await this.pool.query(
        'UPDATE searches SET title = $1 WHERE id = $2',
        [title, id]
      );
    } else {
      return new Promise((resolve, reject) => {
        this.db.run(
          'UPDATE searches SET title = ? WHERE id = ?',
          [title, id],
          (err) => {
            if (err) reject(err);
            resolve();
          }
        );
      });
    }
  }

  async deleteSearch(id) {
    if (this.usePostgres) {
      await this.pool.query(
        'DELETE FROM searches WHERE id = $1',
        [id]
      );
    } else {
      return new Promise((resolve, reject) => {
        this.db.run(
          'DELETE FROM searches WHERE id = ?',
          [id],
          (err) => {
            if (err) reject(err);
            resolve();
          }
        );
      });
    }
  }

  async clearSearches(userId) {
    if (this.usePostgres) {
      await this.pool.query(
        'DELETE FROM searches WHERE user_id = $1',
        [userId]
      );
    } else {
      return new Promise((resolve, reject) => {
        this.db.run(
          'DELETE FROM searches WHERE user_id = ?',
          [userId],
          (err) => {
            if (err) reject(err);
            resolve();
          }
        );
      });
    }
  }
}

module.exports = { Database };