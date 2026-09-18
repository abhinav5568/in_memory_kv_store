const { verify } = require("../utils/jwt.util");

function requireAuth(req, res, next) {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ error: "Not authenticated." });
  }

  try {
    const payload = verify(token);
    req.user = payload; // { id, email, uuid }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired session." });
  }
}

module.exports = { requireAuth };
