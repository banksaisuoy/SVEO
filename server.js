require("dotenv").config();
const express = require("express");
const app = require("./app");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
  require("./routes/categories")(db, isAdmin, isAuthenticated),
);

app.use(express.static(path.join(__dirname, "public")));

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
