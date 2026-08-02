require("dotenv").config();
const app = require("./app");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const multer = require("multer");
const { isAuthenticated, isAdmin } = require("./src/middleware/auth");
const { strictLimiter, generalLimiter } = require("./config/security");

const port = process.env.PORT || 3000;

const dbPath = path.join(__dirname, "database.sqlite");
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Database connection error:", err);
  }
});

const uploadMiddleware = multer({ dest: "public/uploads/" });

app.use("/api/", generalLimiter);

app.use("/api/auth", strictLimiter, require("./routes/auth")());

app.use(
  "/api/videos",
  require("./routes/videos")(db, uploadMiddleware, isAdmin, isAuthenticated),
);
app.use(
  "/api/admin",
  strictLimiter,
  require("./routes/admin")(db, uploadMiddleware, isAdmin, isAuthenticated),
);
app.use(
  "/api/categories",
  require("./routes/categories")(db, isAdmin, isAuthenticated),
);

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});