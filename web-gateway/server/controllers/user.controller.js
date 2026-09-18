const UserModel = require("../models/user.model");

function me(req, res) {
  const user = UserModel.findPublicById(req.user.id);
  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }
  return res.json({ user });
}

module.exports = { me };
