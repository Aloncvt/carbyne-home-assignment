import Database from 'better-sqlite3';
const db = new Database('./database.db');

// ============================================
// table creation
// ============================================

db.exec(`
  CREATE TABLE IF NOT EXISTS rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    keywords TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS calls (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    phone TEXT NOT NULL,
    location TEXT NOT NULL,
    transcript TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    ruleId TEXT NOT NULL,
    callId TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    matchedKeywords TEXT NOT NULL,
    FOREIGN KEY (ruleId) REFERENCES rules(id),
    FOREIGN KEY (callId) REFERENCES calls(id)
  );

  CREATE INDEX IF NOT EXISTS idx_alerts_ruleId ON alerts(ruleId);
  CREATE INDEX IF NOT EXISTS idx_alerts_callId ON alerts(callId);
`);

export default db;