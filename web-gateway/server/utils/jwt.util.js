const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET;
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

if (!SECRET) {
  // Fail loudly at boot rather than silently signing with `undefined`
  throw new Error("JWT_SECRET is not set. Check your .env file.");
}

module.exports = {
  sign: (payload) => jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN }),
  verify: (token) => jwt.verify(token, SECRET),
};
