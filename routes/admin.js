    },
  );


  // GET all videos (Admin only)
  router.get("/videos", isAuthenticated, isAdmin, (req, res) => {
    db.all("SELECT * FROM videos", [], (err, rows) => {
        if (err) {
            console.error("Error fetching videos:", err.message);
            return res.status(500).json({ error: "Failed to fetch videos." });
        }
        res.status(200).json(rows);
    });
  });

  // DELETE a video (Admin only)
  router.delete("/videos/:id", isAuthenticated, isAdmin, (req, res) => {
    const { id } = req.params;