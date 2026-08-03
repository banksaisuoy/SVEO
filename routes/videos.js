const express = require("express");
const { body, validationResult } = require("express-validator");

module.exports = (db, upload, isAdmin, isAuthenticated) => {
  const router = express.Router();
  const { strictLimiter } = require("../config/security");

  router.post(
    "/",
    strictLimiter,
    isAuthenticated,
    isAdmin,
    ],
    (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: errors.array() });
      }
          }
          res.status(201).json({ message: "Success", id: this.lastID });
      });
    }
  );

  router.put(
    "/:id",
    strictLimiter,
    isAuthenticated,
    isAdmin,
    ],
    (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: errors.array() });
      }
          }
          res.status(200).json({ message: "Success" });
      });
    }
  );

  router.get("/", (req, res) => {
    db.all("SELECT * FROM videos", [], (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).json({error: "Failed to fetch videos"});
        }
        res.json(rows);
    });
  });
  
  router.get("/:id", (req, res) => {
    db.get("SELECT * FROM videos WHERE id = ?", [req.params.id], (err, row) => {
        if (err) {
            console.error(err);
            return res.status(500).json({error: "Failed to fetch video"});
        }
        if (!row) {
            return res.status(404).json({error: "Video not found"});
        }
        res.json(row);
    });
  });

  return router;