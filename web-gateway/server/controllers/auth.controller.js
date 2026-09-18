const UserModel = require("../models/user.model");
const { provisionNewUuid } = require("../services/tcpProvision.service");
const { hash, compare } = require("../utils/password.util");
const { sign } = require("../utils/jwt.util");

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function signup(req, res) {
  const { email, password } = req.body;

  if (!isValidEmail(email) || typeof password !== "string" || password.length < 8) {
    return res.status(400).json({
      error: "Valid email and a password of at least 8 characters are required.",
    });
  }

  if (UserModel.findByEmail(email)) {
    return res.status(409).json({ error: "An account with that email already exists." });
  }

  let uuid;
  try {
    // Ask the TCP engine to mint a fresh identity for this user
    uuid = await provisionNewUuid();
  } catch (err) {
    console.error("INIT provisioning failed:", err.message);
    return res.status(502).json({ error: "Could not provision an engine identity. Try again shortly." });
  }

  const passwordHash = await hash(password);
  let userId;
  try {
    userId = UserModel.create({ email, passwordHash, uuid });
  } catch (err) {
    console.error("Failed to persist new user after provisioning uuid:", err.message);
    return res.status(500).json({ error: "Signup failed. Please try again." });
  }

  const token = sign({ id: userId, email, uuid });
  res.cookie("token", token, COOKIE_OPTIONS);

  return res.status(201).json({
    message: "Account created.",
    uuid,
  });
}

async function login(req, res) {
  const { email, password } = req.body;

  if (!isValidEmail(email) || typeof password !== "string") {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const user = UserModel.findByEmail(email);
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials." });
  }

  const passwordMatches = await compare(password, user.password_hash);
  if (!passwordMatches) {
    return res.status(401).json({ error: "Invalid credentials." });
  }

  const token = sign({ id: user.id, email: user.email, uuid: user.uuid });
  res.cookie("token", token, COOKIE_OPTIONS);

  return res.json({ message: "Logged in.", uuid: user.uuid });
}

function logout(req, res) {
  res.clearCookie("token", COOKIE_OPTIONS);
  return res.json({ message: "Logged out." });
}

module.exports = { signup, login, logout };
