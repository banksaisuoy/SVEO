    strictLimiter,
    isAuthenticated,
    isAdmin,
    upload.fields([{ name: 'file', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }]),
    [
      body("title").trim().escape(),
      body("description").trim().escape(),
      body("category_id").trim().escape(),
      body("category").trim().escape(),
      body("tags").trim().escape(),
      body("url").trim()
    ],
    (req, res) => {
      const errors = validationResult(req);
          .status(400)
          .json({ error: "Validation failed", details: errors.array() });
      }
      
      const { title, description, category_id, category, url, tags } = req.body;
      if (!title) return res.status(400).json({ error: "Title is required." });
      
      const file = req.files && req.files['file'] ? req.files['file'][0] : null;
      const thumbnail = req.files && req.files['thumbnail'] ? req.files['thumbnail'][0] : null;

      if (!file && !url) {
          return res.status(400).json({ error: "Video file or URL is required." });
      }

      const filePath = file ? `/uploads/${file.filename}` : null;
      const thumbnailPath = thumbnail ? `/uploads/${thumbnail.filename}` : null;
      const actualUrl = url || null; // Prefer provided URL
      
      const sql = `INSERT INTO videos (title, description, file_path, thumbnail_path, category_id, category, url, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
      db.run(sql, [title, description, filePath, thumbnailPath, category_id, category, actualUrl, tags], function(err) {
          if (err) {
              console.error("Error saving video:", err.message);
              return res.status(500).json({ error: "Failed to save video" });
          }
          res.status(201).json({ message: "Success", id: this.lastID });
      });
    },
  );

    strictLimiter,
    isAuthenticated,
    isAdmin,
    upload.fields([{ name: 'file', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }]),
    [
      body("title").trim().escape(),
      body("description").trim().escape(),
      body("category_id").trim().escape(),
      body("category").trim().escape(),
      body("tags").trim().escape(),
      body("url").trim()
    ],
    (req, res) => {
      const errors = validationResult(req);
          .status(400)
          .json({ error: "Validation failed", details: errors.array() });
      }
      
      const { title, description, category_id, category, url, tags } = req.body;
      if (!title) return res.status(400).json({ error: "Title is required." });
      
      const { id } = req.params;
      
      const file = req.files && req.files['file'] ? req.files['file'][0] : null;
      const thumbnail = req.files && req.files['thumbnail'] ? req.files['thumbnail'][0] : null;
      
      // Build update query dynamically
      let sql = `UPDATE videos SET title = ?, description = ?, category_id = ?, category = ?, url = ?, tags = ?`;
      let params = [title, description, category_id, category, url || null, tags];
      
      if (file) {
          sql += `, file_path = ?`;
          params.push(`/uploads/${file.filename}`);
      }
      if (thumbnail) {
          sql += `, thumbnail_path = ?`;
          params.push(`/uploads/${thumbnail.filename}`);
      }
      
      sql += ` WHERE id = ?`;
      params.push(id);

      db.run(sql, params, function(err) {
          if (err) {
              console.error("Error updating video:", err.message);
              return res.status(500).json({ error: "Failed to update video metadata." });
          }
          if (this.changes === 0) {
              return res.status(404).json({ error: "Video not found." });
          }
          res.status(200).json({ message: "Success" });
      });
    },
  );

  });

  return router;
};
