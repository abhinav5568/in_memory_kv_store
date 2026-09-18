const db = require("../config/db");

const insertStmt = db.prepare(
  `INSERT INTO users (email, password_hash, uuid) VALUES (@email, @password_hash, @uuid)`
);
const findByEmailStmt = db.prepare(`SELECT * FROM users WHERE email = ?`);
const findByIdStmt = db.prepare(
  `SELECT id, email, uuid, created_at FROM users WHERE id = ?`
);

const UserModel = {
  /**
   * @param {{email: string, passwordHash: string, uuid: string}} data
   * @returns {number} inserted row id
   */
  create({ email, passwordHash, uuid }) {
    const result = insertStmt.run({
      email,
      password_hash: passwordHash,
      uuid,
    });
    return result.lastInsertRowid;
  },

  findByEmail(email) {
    return findByEmailStmt.get(email);
  },

  /** Returns a safe (no password hash) view of the user */
  findPublicById(id) {
    return findByIdStmt.get(id);
  },
};

module.exports = UserModel;
