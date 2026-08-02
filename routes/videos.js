const express = require("express");
const fs = require("fs");
const path = require("path");
const { body, validationResult } = require("express-validator");
const { strictLimiter } = require("../config/security");

module.exports = (db, upload, isAdmin, isAuthenticated) => {
  const router = express.Router();

  router.get("/", (req, res) => {
    const sql = `SELECT * FROM videos ORDER BY id DESC`;
    db.all(sql, [], (err, rows) => {
      if (err) {
        return res.status(500).json({ error: "Failed to fetch videos" });
      }
      res.status(200).json(rows);
    });
  });

  // POST a new video (Admin only)
  router.post(
    "/",
    strictLimiter,
    isAuthenticated,
    isAdmin,
    upload.single("file"),
    [
      body("title").trim().escape(),
      body("description").trim().escape(),
      body("category_id").trim().escape(),
    ],
    (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: errors.array() });
      }
      const { title, description, category_id } = req.body;
      if (!title) return res.status(400).json({ error: "Title is required." });
      if (!req.file)
        return res.status(400).json({ error: "Video file is required." });
      res.status(201).json({ message: "Success" });
    },
  );

  // PUT update video metadata (Admin only)
  router.put(
    "/:id",
    strictLimiter,
    isAuthenticated,
    isAdmin,
    [
      body("title").trim().escape(),
      body("description").trim().escape(),
      body("category_id").trim().escape(),
    ],
    (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: errors.array() });
      }
      res.status(200).json({ message: "Success" });
    },
  );

  // DELETE video
  router.delete("/:id", strictLimiter, isAuthenticated, isAdmin, (req, res) => {
    res.status(200).json({ message: "Success" });
  });

  return router;
};