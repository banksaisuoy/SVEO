const request = require("supertest");
const express = require("express");
const { strictLimiter, generalLimiter } = require("../config/security");
const { isAuthenticated, isAdmin } = require("../src/middleware/auth");
const authRoute = require("../routes/auth");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

describe("Auth & Rate Limiting API", () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Needed for JWT signing/verifying in tests
    process.env.JWT_SECRET = "test_secret";
    process.env.ADMIN_USERNAME = "admin_test";
    process.env.ADMIN_PASSWORD = "password_test";

    app.use("/api/auth", strictLimiter, authRoute());

    // Mock protected route
    app.get("/api/protected", isAuthenticated, isAdmin, (req, res) => {
      res.status(200).json({ message: "Welcome Admin" });
    });
  });

  afterEach(() => {
    strictLimiter.resetKey("::ffff:127.0.0.1");
  });

  describe("POST /api/auth/login", () => {
    it("should return token on successful login", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ username: "admin_test", password: "password_test" });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty("token");
      expect(res.body.message).toEqual("Logged in successfully");
    });

    it("should return 401 on invalid username", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ username: "wrong", password: "password_test" });

      expect(res.statusCode).toEqual(401);
      expect(res.body.error).toEqual("Invalid credentials");
    });

    it("should return 401 on invalid password", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ username: "admin_test", password: "wrong" });

      expect(res.statusCode).toEqual(401);
      expect(res.body.error).toEqual("Invalid credentials");
    });

    it("should enforce rate limit after 5 failed/successful attempts", async () => {
      // 5 requests allowed
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post("/api/auth/login")
          .send({ username: "admin_test", password: "password_test" });
      }

      // 6th request should fail with 429
      const res = await request(app)
        .post("/api/auth/login")
        .send({ username: "admin_test", password: "password_test" });

      expect(res.statusCode).toEqual(429);
      expect(res.body).toHaveProperty("error");
      expect(res.body.error).toMatch(/Too many requests/);
    });
  });

  describe("Auth Middleware", () => {
    it("should block access if no token is provided", async () => {
      const res = await request(app).get("/api/protected");
      expect(res.statusCode).toEqual(401);
      expect(res.body.error).toEqual("Unauthorized");
    });

    it("should allow access if valid admin token is provided", async () => {
      const token = jwt.sign(
        { username: "admin_test", role: "admin" },
        "test_secret",
      );

      const res = await request(app)
        .get("/api/protected")
        .set("Authorization", `Bearer ${token}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.message).toEqual("Welcome Admin");
    });

    it("should block access if token is invalid", async () => {
      const res = await request(app)
        .get("/api/protected")
        .set("Authorization", `Bearer invalid_token`);

      expect(res.statusCode).toEqual(401);
      expect(res.body.error).toEqual("Invalid token");
    });
  });
});
