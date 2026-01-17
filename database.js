import Database from 'better-sqlite3';
import { v4 as uuid } from 'uuid';

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
`);

// ============================================
// helpers
// ============================================

function parseRow(row) {
  if (!row) {
    return null;
  }

  // sqlite3 returns 1 / 0 for booleans and strings for arrays, im converting the row back to JS type.
  const result = { ...row };

  if (row.keywords) {
    result.keywords = JSON.parse(row.keywords);
  }

  if (row.matchedKeywords) {
    result.matchedKeywords = JSON.parse(row.matchedKeywords);
  }

  if (row.enabled !== undefined) {
    result.enabled = row.enabled === 1;
  }

  return result;
}

// TODO: seperate helper logic to a different file
function makeId(prefix) {
  const uniquePart = uuid().split('-')[0];
  return `${prefix}_${uniquePart}`;
}

// ============================================
// rules
// ============================================

export function createRule({ name, keywords, enabled = true }) {
  const id = makeId('r');
  const keywordString = JSON.stringify(keywords);
  const enabledValue = enabled ? 1 : 0;

  const query = 'INSERT INTO rules (id, name, keywords, enabled) VALUES (?, ?, ?, ?)';
  db.prepare(query).run(id, name, keywordString, enabledValue);
  
  return { id, name, keywords, enabled };
}

export function getRules(onlyEnabled = false) {
  let sql = 'SELECT * FROM rules';
  
  if (onlyEnabled) {
    sql += ' WHERE enabled = 1';
  }

  const rows = db.prepare(sql).all();
  
  return rows.map(row => parseRow(row));
}

export function updateRule(id, updates) {
  const existing = db.prepare('SELECT * FROM rules WHERE id = ?').get(id);
  if (!existing) {
    return null;
  }

  const fields = [];
  const params = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    params.push(updates.name);
  }

  if (updates.keywords !== undefined) {
    fields.push('keywords = ?');
    params.push(JSON.stringify(updates.keywords));
  }

  if (updates.enabled !== undefined) {
    fields.push('enabled = ?');
    params.push(updates.enabled ? 1 : 0);
  }

  if (fields.length === 0) {
    return parseRow(existing);
  }

  const sql = `UPDATE rules SET ${fields.join(', ')} WHERE id = ?`;
  params.push(id);

  db.prepare(sql).run(...params);

  const updatedRow = db.prepare('SELECT * FROM rules WHERE id = ?').get(id);
  return parseRow(updatedRow);
}

// ============================================
// calls & alerts
// ============================================

export function saveCall(callData) {
  const id = makeId('c');
  const { timestamp, phone, location, transcript } = callData;
  
  const query = `
    INSERT INTO calls (id, timestamp, phone, location, transcript) 
    VALUES (?, ?, ?, ?, ?)
  `;

  db.prepare(query).run(id, timestamp, phone, location, transcript);
  
  return { id, ...callData };
}

export function createAlerts(alertList) {
  const query = `
    INSERT INTO alerts (id, ruleId, callId, createdAt, matchedKeywords) 
    VALUES (?, ?, ?, ?, ?)
  `;
  const insertStmt = db.prepare(query);
  
  const createdAlerts = [];

  // in production code i probably would have used database transactions.
  for (const item of alertList) {
    const id = makeId('a');
    const now = new Date().toISOString();
    const keywordsJson = JSON.stringify(item.matchedKeywords);

    insertStmt.run(id, item.ruleId, item.callId, now, keywordsJson);
    
    createdAlerts.push({ 
      id, 
      ...item, 
      createdAt: now 
    });
  }

  return createdAlerts;
}

export function getAlerts(ruleId, callId) {
  let sql = 'SELECT * FROM alerts WHERE 1=1';
  const params = [];

  if (ruleId) { 
    sql += ' AND ruleId = ?'; 
    params.push(ruleId); 
  }

  if (callId) { 
    sql += ' AND callId = ?'; 
    params.push(callId); 
  }

  const rows = db.prepare(sql).all(...params);
  
  return rows.map(row => parseRow(row));
}

export default db;