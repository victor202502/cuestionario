const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const dataDirectory = path.join(__dirname, 'data');
fs.mkdirSync(dataDirectory, { recursive: true });

const database = new DatabaseSync(path.join(dataDirectory, 'quiz.sqlite'));
database.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    quiz_state TEXT NOT NULL DEFAULT '{}'
  )
`);

function parseQuizState(value) {
  try {
    return JSON.parse(value || '{}');
  } catch {
    return {};
  }
}

module.exports = {
  findUserByUsername(username) {
    return database.prepare('SELECT * FROM users WHERE username = ?').get(username);
  },

  createUser(username, hashedPassword) {
    const result = database.prepare(
      'INSERT INTO users (username, password, quiz_state) VALUES (?, ?, ?)'
    ).run(username, hashedPassword, '{}');
    return database.prepare('SELECT id, username, quiz_state FROM users WHERE id = ?').get(result.lastInsertRowid);
  },

  getUserQuizState(username) {
    const user = database.prepare('SELECT quiz_state FROM users WHERE username = ?').get(username);
    return user ? parseQuizState(user.quiz_state) : null;
  },

  updateUserQuizState(username, quizState) {
    const result = database.prepare(
      'UPDATE users SET quiz_state = ? WHERE username = ?'
    ).run(JSON.stringify(quizState), username);
    return result.changes > 0;
  }
};
