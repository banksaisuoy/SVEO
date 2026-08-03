const request = require("supertest");
const express = require("express");

// Just testing the app-level config for headers and CSRF
const app = require("../app");

describe("Security Hardening Tests", () => {
  
  describe("Security Headers", () => {
    it("should return Helmet security headers", async () => {
      const res = await request(app).get("/api/csrf-token");
      expect(res.headers["content-security-policy"]).toBeDefined();
      expect(res.headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
      expect(res.headers["permissions-policy"]).toBe("camera=(), microphone=(), geolocation=()");
    });
  });

  describe("CSRF Protection", () => {
    it("should block POST requests without CSRF token", async () => {
      const res = await request(app)
        .post("/api/videos")
        .send({ title: "Test" });
      
      expect(res.statusCode).toBe(403);
      expect(res.text).toContain("invalid csrf token");
    });
  });
  
});
