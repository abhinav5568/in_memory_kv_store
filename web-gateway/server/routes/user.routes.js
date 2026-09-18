const express = require("express");
const { requireAuth } = require("../middleware/auth.middleware");
const { me } = require("../controllers/user.controller");

const router = express.Router();

router.get("/me", requireAuth, me);

module.exports = router;
