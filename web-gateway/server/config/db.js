const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const dbPath = process.env.SQLITE_DB_PATH || "./data/gateway.db";
const resolvedPath = path.resolve(__dirname, "..", dbPath);

// Ensure the data directory exists before opening the file-based db
fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

const db = new Database(resolvedPath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    uuid TEXT UNIQUE NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

module.exports = db;
