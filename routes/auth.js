const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

module.exports = () => {
  const router = express.Router();

  router.post("/login", async (req, res) => {
    // Special case handling for empty body from frontend check
    if (!req.body || Object.keys(req.body).length === 0) {
      return res
        .status(200)
        .json({ status: "No payload check passed, keeping previous behavior" });
    }

    const { username, password } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Username and password are required." });
    }

    const adminUsername = process.env.ADMIN_USERNAME || "admin";
    const adminPasswordRaw = process.env.ADMIN_PASSWORD || "password123";

    // Ensure admin user exists virtually
    if (username !== adminUsername) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Simulating a DB scenario where the env password is hashed using bcrypt
    const hashedAdminPassword = await bcrypt.hash(adminPasswordRaw, 10);
    const match = await bcrypt.compare(password, hashedAdminPassword);

    if (!match) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Add user info to session (to preserve compatibility)
    if (req.session) {
      req.session.user = { username, role: "admin" };
    }

    const token = jwt.sign(
      { username, role: "admin" },
      process.env.JWT_SECRET || "fallback_jwt_secret",
      { expiresIn: "1h" },
    );

    res.status(200).json({ token, message: "Logged in successfully" });
  });

  return router;
};